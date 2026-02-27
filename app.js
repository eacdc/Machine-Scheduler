(function () {
  const config = window.ScheduleReorderConfig || {};
  const apiBase = (config.apiBaseUrl || '').replace(/\/$/, '');

  var SCHEDULE_COLUMNS = [
    'ContentName', 'NoOfPages', 'JCQty', 'Forms', 'TotalColors', 'TotalUps', 'OnlineCoating',
    'PrintingImpressions', 'ProductionQty', 'EndDateTime', 'ETotTime', 'DeliveryDate', 'ExpectedComplDate',
    'BookedQuantity', 'PickedQuantity', 'IssueQuantity', 'MaterialStatus', 'ExpReceiptDateMaterial',
    'ItemName', 'CutSize', 'PaperByClient', 'ArtworkStatus', 'PlateOutput', 'LinkofSoftApprovalfile',
    'ToolingDie', 'ToolingBlock', 'Blanket', 'ProcessName', 'ProcessID', 'SalesOrderNo', 'SalesType',
    'PlateQty', 'StartDateTime', 'PendingToPick', 'JobType', 'ProcessNames'
  ];

  const el = {
    database: document.getElementById('database'),
    machine: document.getElementById('machine'),
    btnSearch: document.getElementById('btn-search'),
    btnSave: document.getElementById('btn-save'),
    statusMessage: document.getElementById('statusMessage'),
    saveActions: document.getElementById('saveActions'),
    scheduleSection: document.getElementById('scheduleSection'),
    scheduleTitle: document.getElementById('scheduleTitle'),
    scheduleBody: document.getElementById('scheduleBody'),
    emptyState: document.getElementById('emptyState'),
    selectedCount: document.getElementById('selectedCount'),
    filterContentName: document.getElementById('filterContentName'),
    filterProcessName: document.getElementById('filterProcessName'),
    filterSalesOrderNo: document.getElementById('filterSalesOrderNo'),
    btnUnfilter: document.getElementById('btn-unfilter'),
    unfilterModal: document.getElementById('unfilterModal'),
    modalOk: document.getElementById('modalOk'),
    btnChangeMachine: document.getElementById('btn-change-machine'),
    changeMachineModal: document.getElementById('changeMachineModal'),
    changeMachineTarget: document.getElementById('changeMachineTarget'),
    changeMachineMoveBtn: document.getElementById('changeMachineMoveBtn'),
    changeMachineCancelBtn: document.getElementById('changeMachineCancelBtn'),
    changeMachineError: document.getElementById('changeMachineError'),
    changeMachineCount: document.getElementById('changeMachineCount'),
    changeMachineForm: document.getElementById('changeMachineForm'),
    changeMachineLoading: document.getElementById('changeMachineLoading'),
    changeMachineLoadingMessage: document.getElementById('changeMachineLoadingMessage'),
  };

  let scheduleRows = [];
  let initialOrder = [];
  let sortable = null;
  let statusTimer = null;
  let machinesList = [];

  // Multi-select state
  let selectedIds = new Set();   // set of contentsId strings
  let lastClickedIndex = -1;     // for shift-range selection

  function showStatus(msg, type, autoHide) {
    if (statusTimer) { clearTimeout(statusTimer); statusTimer = null; }
    el.statusMessage.textContent = msg;
    el.statusMessage.className = 'status-message ' + (type || 'info');
    el.statusMessage.classList.remove('hidden');
    if (autoHide !== false && type !== 'error') {
      statusTimer = setTimeout(function () { hideStatus(); }, 3000);
    }
  }

  function hideStatus() {
    el.statusMessage.classList.add('hidden');
  }

  function getDb() {
    return (el.database && el.database.value) || 'KOL';
  }

  function getMachineId() {
    const v = el.machine && el.machine.value;
    return v === '' ? null : parseInt(v, 10);
  }

  function getContentsId(row) {
    return row.JobBookingJobcardContentsID != null
      ? row.JobBookingJobcardContentsID
      : row.JobBookingJobCardContentsID;
  }

  function getCell(row, key) {
    if (row[key] !== undefined && row[key] !== null) return row[key];
    const lower = key.toLowerCase();
    const k = Object.keys(row).find(function (x) { return x.toLowerCase() === lower; });
    return k != null ? row[k] : '';
  }

  function loadMachines() {
    const db = getDb();
    const url = apiBase + '/schedule/machines?database=' + encodeURIComponent(db);
    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error(r.statusText || 'Failed to load machines');
        return r.json();
      })
      .then(function (list) {
        machinesList = list || [];
        el.machine.innerHTML = '<option value="">Select machine</option>';
        machinesList.forEach(function (m) {
          const opt = document.createElement('option');
          opt.value = m.machineId;
          opt.textContent = m.machineName || ('Machine ' + m.machineId);
          el.machine.appendChild(opt);
        });
      });
  }

  function cell(row, key) {
    return escapeHtml(getCell(row, key));
  }

  function renderTable(rows) {
    scheduleRows = rows || [];
    initialOrder = scheduleRows.map(function (r) { return getContentsId(r); });

    // Reset selection
    selectedIds.clear();
    lastClickedIndex = -1;
    if (el.selectedCount) el.selectedCount.classList.add('hidden');

    el.scheduleBody.innerHTML = '';
    el.emptyState.classList.add('hidden');
    if (scheduleRows.length === 0) {
      el.scheduleBody.classList.add('hidden');
      el.emptyState.classList.remove('hidden');
      return;
    }
    el.scheduleBody.classList.remove('hidden');

    scheduleRows.forEach(function (row) {
      const id = getContentsId(row);
      const tr = document.createElement('tr');
      tr.dataset.contentsId = id;
      var cellsHtml = SCHEDULE_COLUMNS.map(function (key) {
        return '<td>' + cell(row, key) + '</td>';
      }).join('');
      tr.innerHTML =
        '<td class="drag-handle" title="Drag to reorder">⋮⋮</td>' +
        '<td class="col-checkbox"><input type="checkbox" class="row-select-cb" data-contents-id="' + escapeHtml(String(id)) + '" title="Select row" /></td>' +
        cellsHtml;

      // Checkbox: sync selection
      var cb = tr.querySelector('.row-select-cb');
      cb.addEventListener('change', function () {
        if (cb.checked) {
          selectedIds.add(String(id));
        } else {
          selectedIds.delete(String(id));
        }
        lastClickedIndex = getRowIndex(tr);
        updateSelectionVisuals();
        updateSelectAllState();
      });
      cb.addEventListener('click', function (e) { e.stopPropagation(); });

      // Row click for selection (ignore drag handle and checkbox)
      tr.addEventListener('click', function (e) {
        if (e.target.classList.contains('drag-handle') || e.target.classList.contains('row-select-cb')) return;
        handleRowClick(e, tr);
        updateSelectAllState();
      });

      el.scheduleBody.appendChild(tr);
    });

    var selectAllCb = document.getElementById('selectAllRows');
    if (selectAllCb) selectAllCb.checked = false;
    updateSelectAllState();

    initSortable();
    updateSaveVisibility();
    clearFilters();
  }

  function escapeHtml(s) {
    if (s == null) return '';
    const t = String(s);
    const div = document.createElement('div');
    div.textContent = t;
    return div.innerHTML;
  }

  function formatDateTime(val) {
    if (val == null || val === '') return '';
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
      }
    }
    return String(val);
  }

  /* ---- Multi-select helpers ---- */

  function getRowIndex(tr) {
    var trs = Array.prototype.slice.call(el.scheduleBody.querySelectorAll('tr[data-contents-id]'));
    return trs.indexOf(tr);
  }

  function updateSelectionVisuals() {
    el.scheduleBody.querySelectorAll('tr[data-contents-id]').forEach(function (tr) {
      var id = tr.dataset.contentsId;
      var isSel = selectedIds.has(id);
      if (isSel) {
        tr.classList.add('selected');
      } else {
        tr.classList.remove('selected');
      }
      var cb = tr.querySelector('.row-select-cb');
      if (cb) cb.checked = isSel;
    });
    if (selectedIds.size > 0) {
      el.selectedCount.textContent = selectedIds.size + ' selected';
      el.selectedCount.classList.remove('hidden');
    } else {
      el.selectedCount.classList.add('hidden');
    }
    updateSelectAllState();
    updateSaveVisibility();
  }

  function updateSelectAllState() {
    var selectAll = document.getElementById('selectAllRows');
    if (!selectAll) return;
    var trs = el.scheduleBody.querySelectorAll('tr[data-contents-id]');
    var n = trs.length;
    if (n === 0) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
      return;
    }
    if (selectedIds.size === 0) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
    } else if (selectedIds.size === n) {
      selectAll.checked = true;
      selectAll.indeterminate = false;
    } else {
      selectAll.checked = false;
      selectAll.indeterminate = true;
    }
  }

  function handleRowClick(e, tr) {
    var id = tr.dataset.contentsId;
    var idx = getRowIndex(tr);

    if (e.shiftKey && lastClickedIndex >= 0) {
      // Range select: select all rows between lastClickedIndex and current
      var trs = Array.prototype.slice.call(el.scheduleBody.querySelectorAll('tr[data-contents-id]'));
      var from = Math.min(lastClickedIndex, idx);
      var to   = Math.max(lastClickedIndex, idx);
      for (var i = from; i <= to; i++) {
        selectedIds.add(trs[i].dataset.contentsId);
      }
    } else if (e.ctrlKey || e.metaKey) {
      // Toggle single row
      if (selectedIds.has(id)) {
        selectedIds.delete(id);
      } else {
        selectedIds.add(id);
      }
      lastClickedIndex = idx;
    } else {
      // Plain click: if this row is the only selected, deselect it; otherwise select only this row
      if (selectedIds.size === 1 && selectedIds.has(id)) {
        selectedIds.clear();
        lastClickedIndex = -1;
      } else {
        selectedIds.clear();
        selectedIds.add(id);
        lastClickedIndex = idx;
      }
    }
    updateSelectionVisuals();
  }

  /* ---- Auto-scroll table when dragging near top/bottom ---- */

  var scrollWhileDragHandler = null;

  function scrollWhileDrag(e) {
    var wrap = el.scheduleBody && el.scheduleBody.closest('.schedule-table-wrap');
    if (!wrap || !wrap.getBoundingClientRect) return;
    var r = wrap.getBoundingClientRect();
    var edge = 56;
    var step = 14;
    if (e.clientY <= r.top + edge) {
      wrap.scrollTop = Math.max(0, wrap.scrollTop - step);
    } else if (e.clientY >= r.bottom - edge) {
      wrap.scrollTop = Math.min(wrap.scrollHeight - wrap.clientHeight, wrap.scrollTop + step);
    }
  }

  /* ---- Sortable with multi-drag support ---- */

  function initSortable() {
    if (sortable) {
      sortable.destroy();
      sortable = null;
    }
    if (!el.scheduleBody || scheduleRows.length === 0) return;

    sortable = new Sortable(el.scheduleBody, {
      handle: '.drag-handle',
      animation: 150,

      onStart: function (evt) {
        var draggedId = evt.item.dataset.contentsId;
        // If the dragged row is not in the selection, treat it as a single-row drag
        if (!selectedIds.has(draggedId)) {
          selectedIds.clear();
          selectedIds.add(draggedId);
          updateSelectionVisuals();
        }
        // Dim all selected rows while dragging
        el.scheduleBody.querySelectorAll('tr.selected').forEach(function (tr) {
          if (tr !== evt.item) tr.style.opacity = '0.35';
        });
        // Start auto-scroll when dragging near top/bottom
        scrollWhileDragHandler = scrollWhileDrag;
        document.addEventListener('mousemove', scrollWhileDragHandler);
      },

      onEnd: function (evt) {
        document.removeEventListener('mousemove', scrollWhileDragHandler);
        scrollWhileDragHandler = null;
        var draggedId = evt.item.dataset.contentsId;
        var newIndex  = evt.newIndex;

        // Restore opacity
        el.scheduleBody.querySelectorAll('tr[data-contents-id]').forEach(function (tr) {
          tr.style.opacity = '';
        });

        if (selectedIds.size <= 1) {
          // Single row — Sortable already placed it correctly
          updateSaveVisibility();
          return;
        }

        // Multi-row: Sortable moved only the dragged row.
        // We need to splice ALL selected rows to the drop position.
        var allTrs = Array.prototype.slice.call(
          el.scheduleBody.querySelectorAll('tr[data-contents-id]')
        );

        // Collect selected rows in their current DOM order (excluding the one Sortable just moved)
        var selectedTrs = allTrs.filter(function (tr) {
          return selectedIds.has(tr.dataset.contentsId) && tr.dataset.contentsId !== draggedId;
        });
        // Include the dragged row itself
        selectedTrs.unshift(evt.item);  // dragged row first (it's already at newIndex)

        // Re-order: remove ALL selected rows from the list
        var remaining = allTrs.filter(function (tr) {
          return !selectedIds.has(tr.dataset.contentsId);
        });

        // The dragged row is now at newIndex in the full list; find where that maps in `remaining`
        // We insert before the first non-selected row that was after position newIndex in allTrs
        var insertBeforeTr = null;
        for (var i = newIndex; i < allTrs.length; i++) {
          if (!selectedIds.has(allTrs[i].dataset.contentsId)) {
            insertBeforeTr = allTrs[i];
            break;
          }
        }

        // Re-insert selected rows into the DOM at the right position
        selectedTrs.forEach(function (tr) {
          if (insertBeforeTr) {
            el.scheduleBody.insertBefore(tr, insertBeforeTr);
          } else {
            el.scheduleBody.appendChild(tr);
          }
        });

        updateSelectionVisuals();
        updateSaveVisibility();
      },
    });
  }

  function getCurrentOrder() {
    const trs = el.scheduleBody ? el.scheduleBody.querySelectorAll('tr[data-contents-id]') : [];
    return Array.prototype.map.call(trs, function (tr) { return parseInt(tr.dataset.contentsId, 10); });
  }

  /* ---- Column filter: Client Name (2), JC Content No (5), Job Name (6) ---- */

  function getFilterValues() {
    var c = (el.filterContentName && el.filterContentName.value) ? el.filterContentName.value.trim().toLowerCase() : '';
    var p = (el.filterProcessName && el.filterProcessName.value) ? el.filterProcessName.value.trim().toLowerCase() : '';
    var s = (el.filterSalesOrderNo && el.filterSalesOrderNo.value) ? el.filterSalesOrderNo.value.trim().toLowerCase() : '';
    return { contentName: c, processName: p, salesOrderNo: s };
  }

  function hasActiveFilter() {
    var f = getFilterValues();
    return f.contentName !== '' || f.processName !== '' || f.salesOrderNo !== '';
  }

  function applyFilter() {
    var f = getFilterValues();
    var trs = el.scheduleBody ? el.scheduleBody.querySelectorAll('tr[data-contents-id]') : [];
    trs.forEach(function (tr) {
      var cells = tr.querySelectorAll('td');
      var contentName = (cells[2] && cells[2].textContent) ? cells[2].textContent.trim().toLowerCase() : '';
      var processName = (cells[29] && cells[29].textContent) ? cells[29].textContent.trim().toLowerCase() : '';
      var salesOrderNo = (cells[31] && cells[31].textContent) ? cells[31].textContent.trim().toLowerCase() : '';
      var show = true;
      if (f.contentName && contentName.indexOf(f.contentName) === -1) show = false;
      if (show && f.processName && processName.indexOf(f.processName) === -1) show = false;
      if (show && f.salesOrderNo && salesOrderNo.indexOf(f.salesOrderNo) === -1) show = false;
      tr.style.display = show ? '' : 'none';
    });
    updateUnfilterButtonVisibility();
  }

  function updateUnfilterButtonVisibility() {
    if (el.btnUnfilter) {
      if (hasActiveFilter()) {
        el.btnUnfilter.classList.remove('hidden');
      } else {
        el.btnUnfilter.classList.add('hidden');
      }
    }
    // Re-evaluate Change machine button since filter affects its enabled state
    updateSaveVisibility();
  }

  function clearFilters() {
    if (el.filterContentName) el.filterContentName.value = '';
    if (el.filterProcessName) el.filterProcessName.value = '';
    if (el.filterSalesOrderNo) el.filterSalesOrderNo.value = '';
    applyFilter();
  }

  function updateSaveVisibility() {
    const current = getCurrentOrder();
    const orderChanged = current.length > 0 && !(
      current.length === initialOrder.length &&
      current.every(function (id, i) { return id === initialOrder[i]; })
    );
    const hasSelection = selectedIds.size > 0;

    // Save order button: visible only when order has actually changed
    if (orderChanged) {
      el.btnSave.classList.remove('hidden');
    } else {
      el.btnSave.classList.add('hidden');
    }

    // Change machine button: visible when rows are selected; disabled when filter is active
    if (el.btnChangeMachine) {
      if (hasSelection) {
        el.btnChangeMachine.classList.remove('hidden');
        el.btnChangeMachine.disabled = hasActiveFilter();
      } else {
        el.btnChangeMachine.classList.add('hidden');
      }
    }

    // Show the bar when either condition is true
    if (orderChanged || hasSelection) {
      el.saveActions.classList.remove('hidden');
    } else {
      el.saveActions.classList.add('hidden');
    }
  }

  function doSearch() {
    const machineId = getMachineId();
    if (machineId == null) {
      showStatus('Please select a machine.', 'error');
      return Promise.reject();
    }
    hideStatus();
    el.btnSearch.disabled = true;
    el.scheduleSection.classList.add('loading');

    const db = getDb();
    const url = apiBase + '/schedule/machine/' + machineId + '?database=' + encodeURIComponent(db);

    return fetch(url)
      .then(function (r) {
        return r.json().then(function (body) {
          if (!r.ok) {
            var msg = (body && body.error) ? body.error : (r.statusText || 'Failed to load schedule');
            throw new Error(msg);
          }
          return body;
        });
      })
      .then(function (data) {
        var rows = Array.isArray(data) ? data : (data && data.data) ? data.data : [];
        if (!Array.isArray(rows)) rows = [];
        el.scheduleSection.classList.remove('hidden');
        el.scheduleTitle.textContent = 'Schedule (drag rows to reorder)';
        renderTable(rows);
        el.scheduleSection.classList.remove('loading');
        if (scheduleRows.length === 0) {
          showStatus('No schedule data for this machine. Run Auto_Schedule_Refresh or check that the machine has jobs in queue.', 'info', false);
        } else {
          showStatus('Loaded ' + scheduleRows.length + ' row(s).', 'info');
        }
      })
      .catch(function (err) {
        el.scheduleSection.classList.remove('loading');
        var msg = err.message || 'Failed to load schedule';
        if (msg === 'Failed to fetch' || msg === 'NetworkError when fetching') {
          msg = 'Cannot reach the API. Is the backend running at ' + apiBase + '? If opening the page as a file, try serving it from a local server.';
        }
        showStatus(msg, 'error', false);
      })
      .finally(function () {
        el.btnSearch.disabled = false;
      });
  }

  function doSave() {
    if (hasActiveFilter()) {
      if (el.unfilterModal) el.unfilterModal.classList.remove('hidden');
      return;
    }
    const machineId = getMachineId();
    if (machineId == null) return;
    const orderedIds = getCurrentOrder();
    if (orderedIds.length === 0) return;

    el.btnSave.disabled = true;
    showStatus('Saving...', 'info', false);

    const db = getDb();
    const url = apiBase + '/schedule/reorder';
    const body = JSON.stringify({
      database: db,
      machineId: machineId,
      orderedJobIds: orderedIds,
    });

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || r.statusText); });
        return r.json();
      })
      .then(function () {
        initialOrder = orderedIds.slice();
        el.saveActions.classList.add('hidden');
        showStatus('Order saved. Schedule has been refreshed.', 'success');
        doSearch();
      })
      .catch(function (err) {
        showStatus(err.message || 'Failed to save order', 'error');
      })
      .finally(function () {
        el.btnSave.disabled = false;
      });
  }

  /* ---- Change Machine modal ---- */

  function openChangeMachineModal() {
    var currentMachineId = getMachineId();
    if (currentMachineId == null) return;

    // Populate target machine dropdown (exclude current machine)
    el.changeMachineTarget.innerHTML = '<option value="">Select machine...</option>';
    machinesList.forEach(function (m) {
      if (m.machineId === currentMachineId) return;
      var opt = document.createElement('option');
      opt.value = m.machineId;
      opt.textContent = m.machineName || ('Machine ' + m.machineId);
      el.changeMachineTarget.appendChild(opt);
    });

    // Show selection count
    if (el.changeMachineCount) {
      el.changeMachineCount.textContent = selectedIds.size;
    }

    // Reset error
    if (el.changeMachineError) {
      el.changeMachineError.textContent = '';
      el.changeMachineError.classList.add('hidden');
    }

    if (el.changeMachineForm) el.changeMachineForm.classList.remove('hidden');
    if (el.changeMachineLoading) el.changeMachineLoading.classList.add('hidden');

    el.changeMachineModal.setAttribute('aria-hidden', 'false');
    el.changeMachineModal.classList.remove('hidden');
  }

  function closeChangeMachineModal() {
    el.changeMachineModal.classList.add('hidden');
    el.changeMachineModal.setAttribute('aria-hidden', 'true');
  }

  function doChangeMachine() {
    var targetMachineIdStr = el.changeMachineTarget.value;
    if (!targetMachineIdStr) {
      if (el.changeMachineError) {
        el.changeMachineError.textContent = 'Please select a target machine.';
        el.changeMachineError.classList.remove('hidden');
      }
      return;
    }

    var sourceMachineId = getMachineId();
    var targetMachineId = parseInt(targetMachineIdStr, 10);
    var jobIds = Array.from(selectedIds).map(Number);
    var targetMachineName = (machinesList.find(function (m) { return m.machineId === targetMachineId; }) || {}).machineName || 'the selected machine';
    var movedCount = jobIds.length;

    el.changeMachineMoveBtn.disabled = true;
    if (el.changeMachineError) {
      el.changeMachineError.classList.add('hidden');
    }

    // Show loading state in modal
    if (el.changeMachineForm) el.changeMachineForm.classList.add('hidden');
    if (el.changeMachineLoading) {
      el.changeMachineLoading.classList.remove('hidden');
      if (el.changeMachineLoadingMessage) {
        el.changeMachineLoadingMessage.textContent = 'Changing machine for the selected job(s)...';
      }
    }

    var loadingMessageTimer = setTimeout(function () {
      if (el.changeMachineLoadingMessage) {
        el.changeMachineLoadingMessage.textContent = 'Reloading updated data...';
      }
    }, 2000);

    var db = getDb();
    fetch(apiBase + '/schedule/change-machine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        database: db,
        sourceMachineId: sourceMachineId,
        targetMachineId: targetMachineId,
        jobIds: jobIds,
      }),
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || r.statusText); });
        return r.json();
      })
      .then(function () {
        clearTimeout(loadingMessageTimer);
        closeChangeMachineModal();
        selectedIds.clear();
        lastClickedIndex = -1;
        showStatus('Reloading updated data...', 'info', false);
        doSearch()
          .then(function () {
            showStatus('Moved ' + movedCount + ' job(s) to ' + targetMachineName + '. Schedule updated.', 'success');
          })
          .catch(function () {});
      })
      .catch(function (err) {
        clearTimeout(loadingMessageTimer);
        if (el.changeMachineForm) el.changeMachineForm.classList.remove('hidden');
        if (el.changeMachineLoading) el.changeMachineLoading.classList.add('hidden');
        if (el.changeMachineError) {
          el.changeMachineError.textContent = err.message || 'Failed to change machine.';
          el.changeMachineError.classList.remove('hidden');
        }
        el.changeMachineMoveBtn.disabled = false;
      });
  }

  if (el.btnChangeMachine) {
    el.btnChangeMachine.addEventListener('click', openChangeMachineModal);
  }

  if (el.changeMachineMoveBtn) {
    el.changeMachineMoveBtn.addEventListener('click', doChangeMachine);
  }

  if (el.changeMachineCancelBtn) {
    el.changeMachineCancelBtn.addEventListener('click', closeChangeMachineModal);
  }

  if (el.changeMachineModal) {
    el.changeMachineModal.addEventListener('click', function (e) {
      if (e.target === el.changeMachineModal) closeChangeMachineModal();
    });
  }

  el.database.addEventListener('change', function () {
    loadMachines().catch(function (e) {
      showStatus(e.message || 'Failed to load machines', 'error');
    });
  });

  el.btnSearch.addEventListener('click', doSearch);
  el.btnSave.addEventListener('click', doSave);

  if (el.filterContentName) {
    el.filterContentName.addEventListener('input', applyFilter);
    el.filterContentName.addEventListener('change', applyFilter);
  }
  if (el.filterProcessName) {
    el.filterProcessName.addEventListener('input', applyFilter);
    el.filterProcessName.addEventListener('change', applyFilter);
  }
  if (el.filterSalesOrderNo) {
    el.filterSalesOrderNo.addEventListener('input', applyFilter);
    el.filterSalesOrderNo.addEventListener('change', applyFilter);
  }
  if (el.btnUnfilter) {
    el.btnUnfilter.addEventListener('click', clearFilters);
  }
  if (el.modalOk && el.unfilterModal) {
    el.modalOk.addEventListener('click', function () {
      el.unfilterModal.classList.add('hidden');
    });
  }
  el.unfilterModal.addEventListener('click', function (e) {
    if (e.target === el.unfilterModal) el.unfilterModal.classList.add('hidden');
  });

  (function () {
    var selectAllCb = document.getElementById('selectAllRows');
    if (!selectAllCb) return;
    selectAllCb.addEventListener('click', function (e) { e.stopPropagation(); });
    selectAllCb.addEventListener('change', function () {
      var trs = el.scheduleBody.querySelectorAll('tr[data-contents-id]');
      if (selectAllCb.checked) {
        trs.forEach(function (tr) {
          selectedIds.add(tr.dataset.contentsId);
        });
      } else {
        selectedIds.clear();
      }
      updateSelectionVisuals();
    });
  })();

  loadMachines().catch(function (e) {
    showStatus(e.message || 'Failed to load machines', 'error');
  });
})();
