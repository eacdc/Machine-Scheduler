(function () {
  const config = window.ScheduleReorderConfig || {};
  const apiBase = (config.apiBaseUrl || '').replace(/\/$/, '');

  // Columns as returned by DB, in order, with display labels. Sales Order No and Sales Type first. Date/datetime columns are formatted for display.
  var SCHEDULE_COLUMNS = [
    { key: 'SalesOrderNo', label: 'Sales Order No' },
    { key: 'SalesType', label: 'Sales Type' },
    { key: 'SODate', label: 'SO Date' },
    { key: 'ScheduleId', label: 'Schedule Id' },
    { key: 'ClientName', label: 'Client Name' },
    { key: 'JobCardContentNo', label: 'JC Content No' },
    { key: 'JCDate', label: 'JC Date' },
    { key: 'JobName', label: 'Job Name' },
    { key: 'ContentName', label: 'Content Name' },
    { key: 'NoOfPages', label: 'No Of Pages' },
    { key: 'JCQty', label: 'JC Qty' },
    { key: 'Forms', label: 'Forms' },
    { key: 'TotalColors', label: 'Total Colors' },
    { key: 'TotalUps', label: 'Total Ups' },
    { key: 'OnlineCoating', label: 'Online Coating' },
    { key: 'PrintingImpressions', label: 'Printing Impressions' },
    { key: 'ProductionQty', label: 'Production Qty' },
    { key: 'EndDateTime', label: 'End Date Time' },
    { key: 'ETotTime', label: 'E Tot Time' },
    { key: 'DeliveryDate', label: 'Delivery Date' },
    { key: 'ExpectedComplDate', label: 'Expected Compl Date' },
    { key: 'BookedQuantity', label: 'Booked Quantity' },
    { key: 'PickedQuantity', label: 'Picked Quantity' },
    { key: 'IssueQuantity', label: 'Issue Quantity' },
    { key: 'MaterialStatus', label: 'Material Status' },
    { key: 'ExpReceiptDateMaterial', label: 'Exp Receipt Date Material' },
    { key: 'ItemName', label: 'Item Name' },
    { key: 'CutSize', label: 'Cut Size' },
    { key: 'PaperByClient', label: 'Paper By Client' },
    { key: 'ArtworkStatus', label: 'Artwork Status' },
    { key: 'PlateOutput', label: 'Plate Output' },
    { key: 'LinkofSoftApprovalfile', label: 'Link Of Soft Approval File' },
    { key: 'ToolingDie', label: 'Tooling Die' },
    { key: 'ToolingBlock', label: 'Tooling Block' },
    { key: 'Blanket', label: 'Blanket' },
    { key: 'ProcessName', label: 'Process Name' },
    { key: 'ProcessID', label: 'Process ID' },
    { key: 'PlateQty', label: 'Plate Qty' },
    { key: 'StartDateTime', label: 'Start Date Time' },
    { key: 'PendingToPick', label: 'Pending To Pick' },
    { key: 'JobType', label: 'Job Type' },
    { key: 'ProcessNames', label: 'Process Names' }
  ];

  var DATE_COLUMN_KEYS = { SODate: 1, JCDate: 1, DeliveryDate: 1, ExpectedComplDate: 1, ExpReceiptDateMaterial: 1, EndDateTime: 1, StartDateTime: 1 };

  /** Numeric columns: min/max filters use raw cell values (not formatted display). */
  var NUMERIC_COLUMN_KEYS = {
    ScheduleId: 1,
    NoOfPages: 1,
    JCQty: 1,
    Forms: 1,
    TotalColors: 1,
    TotalUps: 1,
    PrintingImpressions: 1,
    ProductionQty: 1,
    BookedQuantity: 1,
    PickedQuantity: 1,
    IssueQuantity: 1,
    PlateQty: 1,
    ProcessID: 1,
    PendingToPick: 1,
  };

  function getColumnFilterType(key) {
    if (DATE_COLUMN_KEYS[key]) return 'date';
    if (NUMERIC_COLUMN_KEYS[key]) return 'number';
    return 'text';
  }

  function escapeAttr(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function parseRowDateFromRaw(raw) {
    if (raw == null || raw === '') return null;
    var d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d;
  }

  /** Bounds from date or datetime-local inputs; inclusive range. */
  function boundsFromDateInputs(fromVal, toVal, isDateTime) {
    var fromBound = null;
    var toBound = null;
    if (fromVal && String(fromVal).trim() !== '') {
      if (isDateTime) {
        fromBound = new Date(fromVal);
      } else {
        fromBound = new Date(fromVal + 'T00:00:00');
      }
      if (isNaN(fromBound.getTime())) fromBound = null;
    }
    if (toVal && String(toVal).trim() !== '') {
      if (isDateTime) {
        toBound = new Date(toVal);
      } else {
        toBound = new Date(toVal + 'T23:59:59.999');
      }
      if (isNaN(toBound.getTime())) toBound = null;
    }
    return { from: fromBound, to: toBound };
  }

  function buildFilterCellHtml(col) {
    var k = col.key;
    var t = getColumnFilterType(k);
    if (t === 'text') {
      return '<th><input type="text" class="header-filter-input" data-filter-key="' + escapeAttr(k) + '" data-filter-kind="text" placeholder="Contains…" autocomplete="off" /></th>';
    }
    if (t === 'number') {
      return (
        '<th class="header-filter-cell header-filter-cell--number">' +
        '<input type="text" class="header-filter-input header-filter-num" data-filter-key="' +
        escapeAttr(k) +
        '" data-filter-kind="number" data-filter-role="min" placeholder="Min" inputmode="decimal" autocomplete="off" />' +
        '<input type="text" class="header-filter-input header-filter-num" data-filter-key="' +
        escapeAttr(k) +
        '" data-filter-kind="number" data-filter-role="max" placeholder="Max" inputmode="decimal" autocomplete="off" />' +
        '</th>'
      );
    }
    var isDateTime = k.indexOf('DateTime') !== -1;
    var inputType = isDateTime ? 'datetime-local' : 'date';
    return (
      '<th class="header-filter-cell header-filter-cell--date">' +
      '<input type="' +
      inputType +
      '" class="header-filter-input header-filter-date" data-filter-key="' +
      escapeAttr(k) +
      '" data-filter-kind="date" data-filter-role="from" title="From" />' +
      '<input type="' +
      inputType +
      '" class="header-filter-input header-filter-date" data-filter-key="' +
      escapeAttr(k) +
      '" data-filter-kind="date" data-filter-role="to" title="To" />' +
      '</th>'
    );
  }

  const el = {
    database: document.getElementById('database'),
    machine: document.getElementById('machine'),
    btnSearch: document.getElementById('btn-search'),
    btnRefresh: document.getElementById('btn-refresh'),
    btnSave: document.getElementById('btn-save'),
    statusMessage: document.getElementById('statusMessage'),
    saveActions: document.getElementById('saveActions'),
    scheduleSection: document.getElementById('scheduleSection'),
    scheduleTitle: document.getElementById('scheduleTitle'),
    scheduleTotals: document.getElementById('scheduleTotals'),
    scheduleBody: document.getElementById('scheduleBody'),
    emptyState: document.getElementById('emptyState'),
    selectedCount: document.getElementById('selectedCount'),
    btnExportExcel: document.getElementById('btn-export-excel'),
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
  let isEditableMachine = true;

  const EDITABLE_MACHINE_TYPES = {
    'sheetfed offset': 1,
    'web offset': 1,
  };

  function normalizeMachineType(s) {
    return String(s == null ? '' : s).trim().toLowerCase();
  }

  function getSelectedMachineMeta() {
    const machineId = getMachineId();
    if (machineId == null) return null;
    return machinesList.find(function (m) { return parseInt(m.machineId, 10) === machineId; }) || null;
  }

  function getSelectedMachineType() {
    // Read directly from the selected <option> data attribute — most reliable approach.
    var sel = el.machine;
    if (!sel || sel.selectedIndex < 0) return '';
    var opt = sel.options[sel.selectedIndex];
    return (opt && opt.dataset && opt.dataset.machineType) ? opt.dataset.machineType : '';
  }

  function setEditableModeForSelectedMachine() {
    var type = normalizeMachineType(getSelectedMachineType());
    isEditableMachine = !!EDITABLE_MACHINE_TYPES[type];

    if (el.scheduleSection) {
      if (isEditableMachine) el.scheduleSection.classList.remove('view-only');
      else el.scheduleSection.classList.add('view-only');
    }

    // If we previously had sortable enabled, ensure it is destroyed in view-only mode.
    if (!isEditableMachine && sortable && typeof sortable.destroy === 'function') {
      sortable.destroy();
      sortable = null;
    }
  }

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

  function formatDateValue(val) {
    if (val == null || val === '') return '';
    var s = String(val).trim();
    if (!s) return '';
    var d = new Date(val);
    if (!isNaN(d.getTime())) {
      var hasTime = s.indexOf('T') !== -1 || /\d{1,2}:\d{2}/.test(s);
      return hasTime ? d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : d.toLocaleDateString(undefined, { dateStyle: 'short' });
    }
    return s;
  }

  function getCellValue(row, key) {
    var raw = getCell(row, key);
    if (DATE_COLUMN_KEYS[key] && raw !== '') return formatDateValue(raw);
    return raw;
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
          opt.dataset.machineType = m.machineType || '';
          console.log('option', opt);
          console.log('option value', opt.value);
          console.log('option textContent', opt.textContent);
          console.log('option dataset machineType', opt.dataset.machineType);
          el.machine.appendChild(opt);
        });
      });
  }

  function cell(row, key) {
    return escapeHtml(String(getCellValue(row, key) ?? ''));
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

    // Build header and filter rows from column config (always, so headers show even with no data)
    var table = el.scheduleBody.closest('table');
    if (table) {
      var thead = table.querySelector('thead');
      if (thead) {
        var headerRow = thead.querySelector('#scheduleHeaderRow') || thead.querySelector('tr:first-child');
        var filterRow = thead.querySelector('#scheduleFilterRow') || thead.querySelector('tr.filter-row');
        if (headerRow) {
          headerRow.innerHTML = '<th class="col-drag"></th><th class="col-checkbox"><input type="checkbox" id="selectAllRows" title="Select all" /></th>' +
            SCHEDULE_COLUMNS.map(function (col) { return '<th>' + escapeHtml(col.label) + '</th>'; }).join('');
        }
        if (filterRow) {
          var filterCells = ['<th class="col-drag"></th><th class="col-checkbox"></th>'].concat(
            SCHEDULE_COLUMNS.map(function (col) {
              return buildFilterCellHtml(col);
            })
          );
          filterRow.innerHTML = filterCells.join('');
        }
        bindFilterListeners();
        bindSelectAll();
      }
    }

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
      var cellsHtml = SCHEDULE_COLUMNS.map(function (col) {
        return '<td>' + cell(row, col.key) + '</td>';
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
    updateTotals();
  }

  function escapeHtml(s) {
    if (s == null) return '';
    const t = String(s);
    const div = document.createElement('div');
    div.textContent = t;
    return div.innerHTML;
  }

  var filterInputHandlerBound = null;

  function onFilterInputEvent(e) {
    var t = e.target;
    if (!t || !t.classList || !t.classList.contains('header-filter-input')) return;
    applyFilter();
  }

  function bindFilterListeners() {
    var table = el.scheduleBody && el.scheduleBody.closest('table');
    var thead = table ? table.querySelector('thead') : null;
    if (!thead) return;
    if (filterInputHandlerBound) {
      thead.removeEventListener('input', filterInputHandlerBound);
      thead.removeEventListener('change', filterInputHandlerBound);
    }
    filterInputHandlerBound = onFilterInputEvent;
    thead.addEventListener('input', filterInputHandlerBound);
    thead.addEventListener('change', filterInputHandlerBound);
  }

  function bindSelectAll() {
    var selectAllCb = document.getElementById('selectAllRows');
    if (!selectAllCb) return;
    selectAllCb.addEventListener('change', function () {
      var trs = el.scheduleBody.querySelectorAll('tr[data-contents-id]');
      if (selectAllCb.checked) {
        trs.forEach(function (tr) { selectedIds.add(tr.dataset.contentsId); });
      } else {
        selectedIds.clear();
      }
      updateSelectionVisuals();
    });
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
    if (!isEditableMachine) return;
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

  /* ---- Column filter: every column; text contains, number min/max, date from/to (raw values for date/number) ---- */

  function getFilterInputsRoot() {
    var table = el.scheduleBody && el.scheduleBody.closest('table');
    return table ? table.querySelector('#scheduleFilterRow') : null;
  }

  function hasActiveFilter() {
    var row = getFilterInputsRoot();
    if (!row) return false;
    var inputs = row.querySelectorAll('.header-filter-input');
    for (var i = 0; i < inputs.length; i++) {
      var v = inputs[i].value;
      if (v != null && String(v).trim() !== '') return true;
    }
    return false;
  }

  function rowPassesColumnFilters(row) {
    var filterRow = getFilterInputsRoot();
    if (!filterRow) return true;

    for (var i = 0; i < SCHEDULE_COLUMNS.length; i++) {
      var col = SCHEDULE_COLUMNS[i];
      var key = col.key;
      var kind = getColumnFilterType(key);

      if (kind === 'text') {
        var textInp = filterRow.querySelector(
          '.header-filter-input[data-filter-key="' + key + '"][data-filter-kind="text"]'
        );
        var needle = textInp && textInp.value ? textInp.value.trim().toLowerCase() : '';
        if (!needle) continue;
        var hay = String(getCellValue(row, key) ?? '').toLowerCase();
        if (hay.indexOf(needle) === -1) return false;
        continue;
      }

      if (kind === 'number') {
        var minInp = filterRow.querySelector('[data-filter-key="' + key + '"][data-filter-role="min"]');
        var maxInp = filterRow.querySelector('[data-filter-key="' + key + '"][data-filter-role="max"]');
        var minStr = minInp && minInp.value != null ? String(minInp.value).trim() : '';
        var maxStr = maxInp && maxInp.value != null ? String(maxInp.value).trim() : '';
        if (!minStr && !maxStr) continue;
        var val = parseNumber(getCell(row, key));
        if (minStr !== '') {
          var lo = parseFloat(minStr.replace(/,/g, ''));
          if (!isNaN(lo) && val < lo) return false;
        }
        if (maxStr !== '') {
          var hi = parseFloat(maxStr.replace(/,/g, ''));
          if (!isNaN(hi) && val > hi) return false;
        }
        continue;
      }

      /* date */
      var isDateTime = key.indexOf('DateTime') !== -1;
      var fromInp = filterRow.querySelector(
        '[data-filter-key="' + key + '"][data-filter-kind="date"][data-filter-role="from"]'
      );
      var toInp = filterRow.querySelector(
        '[data-filter-key="' + key + '"][data-filter-kind="date"][data-filter-role="to"]'
      );
      var fromVal = fromInp && fromInp.value ? fromInp.value.trim() : '';
      var toVal = toInp && toInp.value ? toInp.value.trim() : '';
      if (!fromVal && !toVal) continue;
      var bounds = boundsFromDateInputs(fromVal, toVal, isDateTime);
      var raw = getCell(row, key);
      var d = parseRowDateFromRaw(raw);
      if (d == null) return false;
      if (bounds.from != null && d < bounds.from) return false;
      if (bounds.to != null && d > bounds.to) return false;
    }
    return true;
  }

  function applyFilter() {
    var trs = el.scheduleBody ? el.scheduleBody.querySelectorAll('tr[data-contents-id]') : [];
    trs.forEach(function (tr) {
      var id = tr.dataset.contentsId;
      var dataRow = scheduleRows.find(function (r) {
        return String(getContentsId(r)) === String(id);
      });
      if (!dataRow) {
        tr.style.display = 'none';
        return;
      }
      tr.style.display = rowPassesColumnFilters(dataRow) ? '' : 'none';
    });
    updateUnfilterButtonVisibility();
    updateTotals();
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
    var row = getFilterInputsRoot();
    if (row) {
      row.querySelectorAll('.header-filter-input').forEach(function (inp) {
        inp.value = '';
      });
    }
    applyFilter();
  }

  function getDataCellIndexForColumnKey(key) {
    var idx = SCHEDULE_COLUMNS.findIndex(function (c) { return c.key === key; });
    if (idx < 0) return -1;
    // first two td cells are drag handle + checkbox
    return 2 + idx;
  }

  function parseNumber(val) {
    if (val == null) return 0;
    var s = String(val).trim();
    if (!s) return 0;
    s = s.replace(/,/g, '');
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  function formatNumber(n) {
    if (n == null || isNaN(n)) return '0';
    return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function updateTotals() {
    if (!el.scheduleTotals) return;
    var idxPI = getDataCellIndexForColumnKey('PrintingImpressions');
    var idxPQ = getDataCellIndexForColumnKey('ProductionQty');
    if (idxPI < 0 || idxPQ < 0) {
      el.scheduleTotals.classList.add('hidden');
      el.scheduleTotals.textContent = '';
      return;
    }

    var trs = el.scheduleBody ? el.scheduleBody.querySelectorAll('tr[data-contents-id]') : [];
    var totalPI = 0;
    var totalPQ = 0;
    var visibleCount = 0;
    trs.forEach(function (tr) {
      if (tr.style.display === 'none') return;
      var cells = tr.querySelectorAll('td');
      totalPI += parseNumber(cells[idxPI] ? cells[idxPI].textContent : '');
      totalPQ += parseNumber(cells[idxPQ] ? cells[idxPQ].textContent : '');
      visibleCount += 1;
    });

    if (visibleCount === 0) {
      el.scheduleTotals.classList.add('hidden');
      el.scheduleTotals.textContent = '';
      return;
    }

    var pending = totalPI - totalPQ;
    el.scheduleTotals.classList.remove('hidden');
    el.scheduleTotals.innerHTML =
      '<span class="totals-item"><span class="totals-label">Total Printing Impressions:</span> <span class="totals-value">' + escapeHtml(formatNumber(totalPI)) + '</span></span>' +
      '<span class="totals-item"><span class="totals-label">Total Production Qty:</span> <span class="totals-value">' + escapeHtml(formatNumber(totalPQ)) + '</span></span>' +
      '<span class="totals-item"><span class="totals-label">Total Pending Qty (PI − PQ):</span> <span class="totals-value">' + escapeHtml(formatNumber(pending)) + '</span></span>';
  }

  function escapeCsvCell(val) {
    var s = String(val == null ? '' : val);
    if (s.indexOf('"') !== -1 || s.indexOf(',') !== -1 || s.indexOf('\n') !== -1 || s.indexOf('\r') !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function exportToExcel() {
    var trs = el.scheduleBody ? el.scheduleBody.querySelectorAll('tr[data-contents-id]') : [];
    var visible = [];
    for (var i = 0; i < trs.length; i++) {
      if (trs[i].style.display !== 'none') visible.push(trs[i]);
    }
    if (visible.length === 0) {
      showStatus('No rows to export.', 'info');
      return;
    }
    var headers = SCHEDULE_COLUMNS.map(function (col) { return escapeCsvCell(col.label); });
    var rows = [headers.join(',')];
    visible.forEach(function (tr) {
      var cells = tr.querySelectorAll('td');
      var dataStart = 2;
      var vals = [];
      for (var c = dataStart; c < cells.length; c++) {
        vals.push(escapeCsvCell((cells[c] && cells[c].textContent) ? cells[c].textContent.trim() : ''));
      }
      rows.push(vals.join(','));
    });
    var csv = '\uFEFF' + rows.join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'schedule-export.csv';
    a.click();
    URL.revokeObjectURL(url);
    showStatus('Exported ' + visible.length + ' row(s) to schedule-export.csv', 'info');
  }

  function updateSaveVisibility() {
    if (!isEditableMachine) {
      // View-only mode: hide all edit actions.
      if (el.btnSave) el.btnSave.classList.add('hidden');
      if (el.btnChangeMachine) el.btnChangeMachine.classList.add('hidden');
      if (el.saveActions) el.saveActions.classList.add('hidden');
      return;
    }
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
    setEditableModeForSelectedMachine();
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

        // --- DEBUG: log first 3 rows from API response ---
        console.log('[frontend] total rows from API:', rows.length);
        rows.slice(0, 3).forEach(function (row, i) {
          console.log('[frontend] row[' + i + '] keys:', Object.keys(row));
          console.log('[frontend] row[' + i + '] data:', JSON.stringify(row));
        });
        // --- END DEBUG ---

        el.scheduleSection.classList.remove('hidden');
        el.scheduleTitle.textContent = isEditableMachine
          ? 'Schedule (drag rows to reorder)'
          : 'Schedule (view only)';
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

  function doRefresh() {
    const db = getDb();
    const url = apiBase + '/schedule/refresh';
    el.btnRefresh.disabled = true;
    showStatus('Refreshing schedule...', 'info', false);
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ database: db }),
    })
      .then(function (r) {
        return r.json().then(function (body) {
          if (!r.ok) {
            var msg = (body && body.error) ? body.error : (r.statusText || 'Failed to refresh schedule');
            throw new Error(msg);
          }
          return body;
        });
      })
      .then(function () {
        showStatus('Schedule refreshed successfully.', 'success');
        // If machine is selected, reload table with latest data.
        if (getMachineId() != null) {
          return doSearch();
        }
      })
      .catch(function (err) {
        showStatus(err.message || 'Failed to refresh schedule', 'error', false);
      })
      .finally(function () {
        el.btnRefresh.disabled = false;
      });
  }

  function doSave() {
    if (!isEditableMachine) return;
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
    if (!isEditableMachine) return;
    var currentMachineId = getMachineId();
    if (currentMachineId == null) return;

    // Populate target machine dropdown (exclude current machine)
    el.changeMachineTarget.innerHTML = '<option value="">Select machine...</option>';
    machinesList.forEach(function (m) {
      // Only allow switching into Offset machines.
      var t = normalizeMachineType(m.machineType || m.MachineType || '');
      if (!EDITABLE_MACHINE_TYPES[t]) return;
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

    // Ensure Move button state is correct when opening (fixes it staying disabled after a previous successful move)
    if (el.changeMachineMoveBtn) el.changeMachineMoveBtn.disabled = !el.changeMachineTarget.value;

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

  // Enable/disable Move button when target machine selection changes
  if (el.changeMachineTarget && el.changeMachineMoveBtn) {
    el.changeMachineTarget.addEventListener('change', function () {
      el.changeMachineMoveBtn.disabled = !el.changeMachineTarget.value;
    });
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
  if (el.btnRefresh) el.btnRefresh.addEventListener('click', doRefresh);
  el.btnSave.addEventListener('click', doSave);
  if (el.btnExportExcel) {
    el.btnExportExcel.addEventListener('click', exportToExcel);
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
