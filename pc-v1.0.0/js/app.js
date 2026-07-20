/* PC 意图 QA 对维护 · v1.0.0 */
(function () {
  'use strict';

  var PAGE_SIZE = 10;
  var DATA_URL = 'data/qa-workspace.json';

  var state = {
    workspace: null,
    view: 'list',
    sortBy: 'id',
    sortDir: 'asc',
    filters: { a: '', status: '', pairType: '', multiOnly: false, q: '' },
    page: 1,
    selected: new Set(),
    editorIndex: null
  };

  function $(sel) {
    return document.querySelector(sel);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function tagHtml(name) {
    var c = QaFeatureIds.TAG_COLORS[name] || { bg: '#F4F4F5', fg: '#18181B' };
    return (
      '<span class="qa-tag" style="background:' +
      c.bg +
      ';color:' +
      c.fg +
      '">' +
      escapeHtml(name) +
      '</span>'
    );
  }

  function statusHtml(status) {
    var s = status || QaCore.STATUS.PUBLISHED;
    var cls = 'status-tag';
    if (s === QaCore.STATUS.DRAFT) cls += ' status-tag--draft';
    else if (s === QaCore.STATUS.OFFLINE) cls += ' status-tag--offline';
    else cls += ' status-tag--live';
    return '<span class="' + cls + '">' + escapeHtml(QaCore.statusLabel(s)) + '</span>';
  }

  function pairTypeHtml(pairType) {
    var pt = QaCore.normalizePairType(pairType);
    var cls = pt === QaCore.PAIR_TYPE.KNOWLEDGE ? 'type-tag type-tag--knowledge' : 'type-tag type-tag--function';
    return '<span class="' + cls + '">' + escapeHtml(QaCore.pairTypeLabel(pt)) + '</span>';
  }

  function aCellHtml(p) {
    if (QaCore.isKnowledgePair(p)) {
      return (
        '<td class="col-a-text" title="' +
        escapeHtml(p.a) +
        '">' +
        escapeHtml(p.a) +
        '</td>'
      );
    }
    return '<td>' + tagHtml(p.a) + '</td>';
  }

  function updateFilterAVisibility() {
    var wrap = $('#filter-field-a');
    var isKnowledge = state.filters.pairType === QaCore.PAIR_TYPE.KNOWLEDGE;
    if (wrap) wrap.hidden = isKnowledge;
    if (isKnowledge) {
      state.filters.a = '';
      var sel = $('#filter-a');
      if (sel) sel.value = '';
    }
  }

  function syncEditorPairTypeUI() {
    var pt = QaCore.normalizePairType($('#field-pair-type').value);
    var isKnowledge = pt === QaCore.PAIR_TYPE.KNOWLEDGE;
    $('#field-wrap-a-function').hidden = isKnowledge;
    $('#field-wrap-a-knowledge').hidden = !isKnowledge;
  }

  function persistWorkspace() {
    if (state.workspace) QaCore.saveLocal(state.workspace);
  }

  function rebuildWorkspace() {
    state.workspace = QaCore.buildWorkspace(state.workspace.pairs, state.workspace.version);
  }

  function comparePairIds(a, b) {
    var ia = parseInt(a.id, 10);
    var ib = parseInt(b.id, 10);
    if (!isNaN(ia) && !isNaN(ib) && ia !== ib) return ia - ib;
    return String(a.id || '').localeCompare(String(b.id || ''));
  }

  function applyListSort(pairs) {
    if (state.filters.multiOnly) return QaCore.sortPairsMultiFilter(pairs);
    var dir = state.sortDir === 'desc' ? -1 : 1;
    return pairs.slice().sort(function (a, b) {
      var cmp = 0;
      if (state.sortBy === 'id') cmp = comparePairIds(a, b);
      else if (state.sortBy === 'q') cmp = a.q.localeCompare(b.q, 'zh-CN');
      else if (state.sortBy === 'a') cmp = a.a.localeCompare(b.a, 'zh-CN');
      if (cmp !== 0) return cmp * dir;
      if (state.sortBy !== 'q') {
        cmp = a.q.localeCompare(b.q, 'zh-CN');
        if (cmp !== 0) return cmp;
      }
      if (state.sortBy !== 'a') {
        cmp = a.a.localeCompare(b.a, 'zh-CN');
        if (cmp !== 0) return cmp;
      }
      return comparePairIds(a, b);
    });
  }

  function getFilteredPairs() {
    var multi = QaCore.multiQSet(state.workspace.pairs);
    var f = state.filters;
    var filtered = state.workspace.pairs.filter(function (p) {
      if (f.pairType && QaCore.normalizePairType(p.pairType) !== f.pairType) return false;
      if (f.a) {
        if (!QaCore.isFunctionPair(p) || p.a !== f.a) return false;
      }
      if (f.status && p.status !== f.status) return false;
      if (f.multiOnly && !multi.has(p.q)) return false;
      if (f.q) {
        var q = f.q.trim().toLowerCase();
        if (p.q.toLowerCase().indexOf(q) < 0 && QaCore.normalizeQ(p.q).indexOf(QaCore.normalizeQ(q)) < 0) {
          return false;
        }
      }
      return true;
    });
    return applyListSort(filtered);
  }

  function sortTh(label, field, extraClass) {
    var disabled = state.filters.multiOnly;
    var active = !disabled && state.sortBy === field;
    var ascOn = active && state.sortDir === 'asc';
    var descOn = active && state.sortDir === 'desc';
    return (
      '<th class="col-sortable' +
      (extraClass ? ' ' + extraClass : '') +
      (active ? ' is-active' : '') +
      (disabled ? ' is-disabled' : '') +
      '" data-sort="' +
      field +
      '" title="' +
      (disabled ? '仅歧义 Q 模式下固定按 Q 排序' : '点击切换排序') +
      '">' +
      label +
      '<span class="th-sort" aria-hidden="true">' +
      '<span class="th-sort__btn' +
      (ascOn ? ' is-on' : '') +
      '">↑</span>' +
      '<span class="th-sort__btn' +
      (descOn ? ' is-on' : '') +
      '">↓</span>' +
      '</span></th>'
    );
  }

  function toggleSort(field) {
    if (state.filters.multiOnly) return;
    if (state.sortBy === field) {
      state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortBy = field;
      state.sortDir = 'asc';
    }
    state.page = 1;
    renderTable();
  }

  function openTrialModal(focusInput, presetText) {
    var modal = $('#modal-trial');
    if (modal) modal.classList.add('is-open');
    if (presetText != null) {
      var input = $('#trial-input');
      if (input) input.value = presetText;
    }
    if (focusInput) {
      var inputEl = $('#trial-input');
      if (inputEl) inputEl.focus();
    }
    if (presetText) runTrial(presetText);
    else $('#trial-result').innerHTML = '';
  }

  function closeTrialModal() {
    var modal = $('#modal-trial');
    if (modal) modal.classList.remove('is-open');
  }

  var importPendingFile = null;

  function resetImportModal() {
    importPendingFile = null;
    var nameEl = $('#import-file-name');
    var dropzone = $('#import-dropzone');
    var startBtn = $('#btn-import-start');
    var input = $('#file-import');
    if (nameEl) {
      nameEl.textContent = '';
      nameEl.hidden = true;
    }
    if (dropzone) dropzone.classList.remove('has-file', 'is-dragover');
    if (startBtn) startBtn.disabled = true;
    if (input) input.value = '';
  }

  function openImportModal() {
    resetImportModal();
    var modal = $('#modal-import');
    if (modal) modal.classList.add('is-open');
  }

  function closeImportModal() {
    var modal = $('#modal-import');
    if (modal) modal.classList.remove('is-open');
    resetImportModal();
  }

  function isExcelFile(file) {
    if (!file) return false;
    var name = (file.name || '').toLowerCase();
    return name.endsWith('.xlsx') || name.endsWith('.xls');
  }

  function setImportPendingFile(file) {
    if (!isExcelFile(file)) {
      QaDialog.alert('请选择 .xlsx 或 .xls 格式的 Excel 文件', {
        type: 'warning',
        title: '文件格式不正确'
      });
      return;
    }
    importPendingFile = file;
    var nameEl = $('#import-file-name');
    var dropzone = $('#import-dropzone');
    var startBtn = $('#btn-import-start');
    if (nameEl) {
      nameEl.textContent = file.name;
      nameEl.hidden = false;
    }
    if (dropzone) dropzone.classList.add('has-file');
    if (startBtn) startBtn.disabled = false;
  }

  function writeQaWorkbook(filename, rows) {
    if (typeof XLSX === 'undefined') {
      QaDialog.alert('Excel 库未加载，请刷新页面后重试', { type: 'error', title: '无法导出' });
      return;
    }
    var ws = XLSX.utils.aoa_to_sheet(rows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'QA对');
    XLSX.writeFile(wb, filename);
  }

  function downloadImportTemplate() {
    var version = state.workspace ? state.workspace.version : 'v1.5.0';
    writeQaWorkbook('QA对-主功能口语映射-模板-' + version + '.xlsx', [
      ['序号', 'Q', 'A', '类型', '备注'],
      [1, '今天有哪些待跟进', '今日待跟', '功能', ''],
      [2, '你们交期怎么算', '交期按产能与物料综合评审，具体以系统评审结果为准。', '知识', '']
    ]);
  }

  function downloadBlob(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'application/octet-stream' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function renderAll() {
    if (!state.workspace) return;
    renderStats();
    renderTable();
  }

  function renderStats() {
    var pairs = state.workspace.pairs;
    var multi = state.workspace.multiQ || [];
    var fn = 0;
    var kn = 0;
    pairs.forEach(function (p) {
      if (QaCore.isKnowledgePair(p)) kn += 1;
      else fn += 1;
    });
    $('#stat-function').textContent = String(fn);
    $('#stat-knowledge').textContent = String(kn);
    $('#stat-unique-q').textContent = String(
      new Set(
        pairs.map(function (p) {
          return p.q;
        })
      ).size
    );
    $('#stat-multi').textContent = String(multi.length);
  }

  function renderTableHead() {
    var head = $('#qa-table-head');
    var batchBtn = $('#btn-batch-delete');
    if (!head) return;
    if (state.view === 'multi') {
      head.innerHTML =
        '<tr>' +
        '<th class="col-no">序号</th>' +
        '<th>用户说法 Q</th>' +
        '<th>命中主功能 A</th>' +
        '<th class="col-actions">操作</th>' +
        '</tr>';
      if (batchBtn) batchBtn.hidden = true;
      var sep = $('#toolbar-actions-sep');
      if (sep) sep.hidden = true;
      return;
    }
    head.innerHTML =
      '<tr>' +
      '<th class="col-check"><input type="checkbox" id="check-all" /></th>' +
      sortTh('序号', 'id', 'col-no') +
      sortTh('用户说法 Q', 'q', 'col-q') +
      '<th>类型</th>' +
      sortTh('A / 知识文案', 'a') +
      '<th>备注</th>' +
      '<th>状态</th>' +
      '<th class="col-actions">操作</th>' +
      '</tr>';
    if (batchBtn) batchBtn.hidden = false;
    var sep = $('#toolbar-actions-sep');
    if (sep) sep.hidden = false;
  }

  function onCheckAllChange(e) {
    var filtered = getFilteredPairs();
    var start = (state.page - 1) * PAGE_SIZE;
    var pageItems = filtered.slice(start, start + PAGE_SIZE);
    pageItems.forEach(function (p) {
      var idx = state.workspace.pairs.indexOf(p);
      if (e.target.checked) state.selected.add(idx);
      else state.selected.delete(idx);
    });
    renderTable();
  }

  function renderTable() {
    renderTableHead();
    var tbody = $('#qa-table-body');
    if (state.view === 'multi') {
      renderMultiTable(tbody);
      return;
    }
    var filtered = getFilteredPairs();
    var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    var start = (state.page - 1) * PAGE_SIZE;
    var pageItems = filtered.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = pageItems
      .map(function (p, i) {
        var idx = state.workspace.pairs.findIndex(function (x) {
          return x.id === p.id;
        });
        if (idx < 0) idx = state.workspace.pairs.indexOf(p);
        var checked = state.selected.has(idx) ? ' checked' : '';
        var rowNo = start + i + 1;
        var statusAction = '';
        if (p.status === QaCore.STATUS.PUBLISHED) {
          statusAction =
            '<button type="button" class="row-action-link" data-action="go-offline" data-idx="' +
            idx +
            '">下线</button>';
        } else if (p.status === QaCore.STATUS.DRAFT || p.status === QaCore.STATUS.OFFLINE) {
          statusAction =
            '<button type="button" class="row-action-link" data-action="go-live" data-idx="' +
            idx +
            '">上线</button>';
        }
        return (
          '<tr data-idx="' +
          idx +
          '">' +
          '<td><input type="checkbox" class="row-check" data-idx="' +
          idx +
          '"' +
          checked +
          ' /></td>' +
          '<td class="col-no">' +
          rowNo +
          '</td>' +
          '<td class="col-q"><button type="button" class="link-btn" data-action="edit" data-idx="' +
          idx +
          '">' +
          escapeHtml(p.q) +
          '</button></td>' +
          '<td>' +
          pairTypeHtml(p.pairType) +
          '</td>' +
          aCellHtml(p) +
          '<td class="col-note" title="' +
          escapeHtml(p.note || '') +
          '">' +
          escapeHtml(p.note || '—') +
          '</td>' +
          '<td class="col-status">' +
          statusHtml(p.status) +
          '</td>' +
          '<td class="col-actions">' +
          '<button type="button" class="row-action-link" data-action="edit" data-idx="' +
          idx +
          '">编辑</button>' +
          '<button type="button" class="row-action-link" data-action="duplicate" data-idx="' +
          idx +
          '">复制</button>' +
          statusAction +
          (QaCore.canDeletePair(p)
            ? '<button type="button" class="row-action-link row-action-link--danger" data-action="delete" data-idx="' +
              idx +
              '">删除</button>'
            : '') +
          '</td></tr>'
        );
      })
      .join('');

    if (!pageItems.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">无匹配数据</td></tr>';
    }

    $('#page-info').textContent =
      '第 ' +
      state.page +
      ' / ' +
      totalPages +
      ' 页 · 共 ' +
      filtered.length +
      ' 条' +
      (state.filters.multiOnly
        ? ' · ' + QaCore.buildMultiQ(state.workspace.pairs).length + ' 个歧义 Q'
        : ' · 已选 ' + state.selected.size + ' 条');
    $('#btn-prev').disabled = state.page <= 1;
    $('#btn-next').disabled = state.page >= totalPages;
  }

  function renderMultiTable(tbody) {
    var multi = state.workspace.multiQ || [];
    var totalPages = Math.max(1, Math.ceil(multi.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    var start = (state.page - 1) * PAGE_SIZE;
    var pageItems = multi.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = pageItems
      .map(function (m, i) {
        return (
          '<tr>' +
          '<td class="col-no">' +
          (start + i + 1) +
          '</td>' +
          '<td class="col-q">' +
          escapeHtml(m.q) +
          '</td>' +
          '<td>' +
          m.a.map(tagHtml).join(' ') +
          '</td>' +
          '<td class="col-actions">' +
          '<button type="button" class="btn btn--ghost btn--sm" data-action="filter-q" data-q="' +
          escapeHtml(m.q) +
          '">筛选此 Q</button></td></tr>'
        );
      })
      .join('');
    if (!pageItems.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-cell">暂无歧义 Q</td></tr>';
    }
    $('#page-info').textContent =
      '第 ' + state.page + ' / ' + totalPages + ' 页 · 歧义 Q 共 ' + multi.length + ' 条';
    $('#btn-prev').disabled = state.page <= 1;
    $('#btn-next').disabled = state.page >= totalPages;
  }

  function setPairStatus(index, nextStatus) {
    var pair = state.workspace.pairs[index];
    if (!pair) return false;
    pair = QaCore.enrichPair(Object.assign({}, pair, { status: nextStatus }));
    state.workspace.pairs[index] = pair;
    rebuildWorkspace();
    persistWorkspace();
    renderAll();
    return true;
  }

  function duplicatePair(idx) {
    var src = state.workspace.pairs[idx];
    if (!src) {
      QaDialog.alert('未找到要复制的记录', { type: 'warning' });
      return;
    }
    var copy = QaCore.enrichPair({
      id: QaCore.nextId(state.workspace.pairs),
      q: src.q + '（副本）',
      a: src.a,
      pairType: src.pairType,
      note: src.note || '',
      status: QaCore.STATUS.DRAFT
    });
    state.workspace.pairs.push(copy);
    rebuildWorkspace();
    persistWorkspace();
    renderAll();
    openEditor(state.workspace.pairs.length - 1);
  }

  function updateEditorFooter(isNew, status) {
    var hint = $('#editor-status-hint');
    var s = status || QaCore.STATUS.DRAFT;

    if (hint) {
      if (isNew) {
        hint.textContent = '新建默认为草稿';
        hint.hidden = false;
      } else {
        hint.textContent = '当前状态：' + QaCore.statusLabel(s);
        hint.hidden = false;
      }
    }
  }

  function readEditorPair(statusOverride) {
    var status =
      statusOverride != null
        ? statusOverride
        : state.editorIndex != null
          ? state.workspace.pairs[state.editorIndex].status
          : QaCore.STATUS.DRAFT;
    var pairType = QaCore.normalizePairType($('#field-pair-type').value);
    var a =
      pairType === QaCore.PAIR_TYPE.KNOWLEDGE
        ? $('#field-a-knowledge').value.trim()
        : $('#field-a').value;
    return {
      id:
        state.editorIndex != null
          ? state.workspace.pairs[state.editorIndex].id
          : QaCore.nextId(state.workspace.pairs),
      pairType: pairType,
      q: $('#field-q').value.trim(),
      a: a,
      note: $('#field-note').value.trim(),
      status: status
    };
  }

  function openEditor(index) {
    state.editorIndex = index;
    var isNew = index == null;
    var p = isNew
      ? {
          id: QaCore.nextId(state.workspace.pairs),
          pairType: QaCore.PAIR_TYPE.FUNCTION,
          q: '',
          a: QaFeatureIds.FEATURE_NAMES[0],
          note: '',
          status: QaCore.STATUS.DRAFT
        }
      : state.workspace.pairs[index];
    $('#editor-title').textContent = isNew ? '新增 QA 对' : '编辑 QA 对';
    $('#field-pair-type').value = QaCore.normalizePairType(p.pairType);
    $('#field-q').value = p.q || '';
    if (QaCore.isKnowledgePair(p)) {
      $('#field-a-knowledge').value = p.a || '';
      $('#field-a').value = QaFeatureIds.FEATURE_NAMES[0];
    } else {
      $('#field-a').value = p.a || QaFeatureIds.FEATURE_NAMES[0];
      $('#field-a-knowledge').value = '';
    }
    $('#field-note').value = p.note || '';
    syncEditorPairTypeUI();
    $('#editor-error').textContent = '';
    updateEditorFooter(isNew, p.status);
    $('#drawer').classList.add('is-open');
    $('#drawer-backdrop').classList.add('is-open');
  }

  function closeEditor() {
    state.editorIndex = null;
    $('#drawer').classList.remove('is-open');
    $('#drawer-backdrop').classList.remove('is-open');
  }

  function commitEditorPair(pair, closeAfter) {
    var errors = QaCore.validatePair(pair, state.workspace.pairs, state.editorIndex);
    if (errors.length) {
      $('#editor-error').textContent = errors.join('；');
      return false;
    }
    pair = QaCore.enrichPair(pair);
    if (state.editorIndex != null) state.workspace.pairs[state.editorIndex] = pair;
    else state.workspace.pairs.push(pair);
    rebuildWorkspace();
    persistWorkspace();
    if (closeAfter) closeEditor();
    else updateEditorFooter(false, pair.status);
    renderAll();
    return true;
  }

  function saveEditor() {
    commitEditorPair(readEditorPair(), true);
  }

  function deleteIndices(indices) {
    if (!indices.length) return;
    var published = indices.filter(function (i) {
      return state.workspace.pairs[i] && state.workspace.pairs[i].status === QaCore.STATUS.PUBLISHED;
    });
    if (published.length) {
      QaDialog.alert('已上线的 QA 对不可直接删除，请先下线。', {
        type: 'warning',
        title: '无法删除'
      });
      return;
    }
    QaDialog.confirm('确定删除选中的 ' + indices.length + ' 条 QA 对？删除后不可恢复。', {
      title: '确认删除',
      confirmText: '删除',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      var set = new Set(indices);
      state.workspace.pairs = state.workspace.pairs.filter(function (_, i) {
        return !set.has(i);
      });
      state.selected.clear();
      rebuildWorkspace();
      persistWorkspace();
      renderAll();
    });
  }

  function runTrial(text) {
    text = text || $('#trial-input').value;
    var norm = IntentMatchPc.normalizeUtterance(text);
    var fnPairs = QaCore.pairsForMatch(state.workspace.pairs);
    var knPairs = QaCore.pairsForKnowledgeMatch(state.workspace.pairs);
    var hits = IntentMatchPc.matchMainFunctions(text, fnPairs);
    var kHits = IntentMatchPc.matchKnowledge(text, knPairs);
    var box = $('#trial-result');
    if (!norm) {
      box.innerHTML = '<span class="muted">请输入话术</span>';
      return;
    }
    var html =
      '<div class="trial-line"><span class="muted">归一化：</span>' +
      escapeHtml(norm) +
      '</div>';
    html += '<div class="trial-section"><div class="trial-section__title">L0 主功能</div>';
    if (!hits.length) {
      html += '<div class="trial-line trial-line--warn">未命中任何主功能</div>';
    } else {
      if (hits.length > 1) {
        html += '<div class="trial-line trial-line--warn">命中 ' + hits.length + ' 个主功能（方案 C 并集）</div>';
      }
      html += hits
        .map(function (h) {
          return (
            '<div class="trial-hit">' +
            tagHtml(h.name) +
            ' <code>' +
            escapeHtml(h.id) +
            '</code>' +
            (h.note ? ' <span class="muted">· ' + escapeHtml(h.note) + '</span>' : '') +
            '</div>'
          );
        })
        .join('');
    }
    html += '</div>';
    html += '<div class="trial-section"><div class="trial-section__title">知识话术</div>';
    if (!kHits.length) {
      html += '<div class="trial-line muted">未命中知识</div>';
    } else {
      html += kHits
        .map(function (k) {
          return (
            '<div class="trial-knowledge">' +
            '<div class="trial-knowledge__q muted">Q：' +
            escapeHtml(k.q) +
            '</div>' +
            '<div class="trial-knowledge__a">' +
            escapeHtml(k.text) +
            '</div></div>'
          );
        })
        .join('');
    }
    html += '</div>';
    if (hits.length && kHits.length) {
      html +=
        '<div class="trial-line trial-line--warn">同时命中功能与知识时，实际对话路由以功能为准。</div>';
    } else if (!hits.length && kHits.length) {
      html += '<div class="trial-line muted">无功能命中时可返回知识文案。</div>';
    }
    box.innerHTML = html;
  }

  function exportExcel() {
    if (typeof XLSX === 'undefined') {
      QaDialog.alert('Excel 库未加载，请刷新页面后重试', { type: 'error', title: '无法导出' });
      return;
    }
    var errors = QaCore.validateAll(state.workspace.pairs);
    if (errors.length) {
      QaDialog.alert('导出前校验失败：\n' + errors.slice(0, 5).join('\n'), {
        type: 'error',
        title: '无法导出'
      });
      return;
    }
    var rows = [['序号', 'Q', 'A', '类型', '备注']];
    QaCore.sortPairsById(state.workspace.pairs).forEach(function (p, i) {
      rows.push([p.id || i + 1, p.q, p.a, QaCore.pairTypeLabel(p.pairType), p.note || '']);
    });
    writeQaWorkbook('QA对-主功能口语映射-' + state.workspace.version + '.xlsx', rows);
  }

  function importExcelFile(file) {
    if (!file) return;
    if (typeof XLSX === 'undefined') {
      QaDialog.alert('Excel 库未加载，请刷新页面后重试', { type: 'error', title: '无法导入' });
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      var wb = XLSX.read(e.target.result, { type: 'array' });
      var sheet = wb.Sheets['QA对'] || wb.Sheets[wb.SheetNames[0]];
      if (!sheet) {
        QaDialog.alert('未找到名为「QA对」的工作表，请使用标准模板。', {
          type: 'error',
          title: '无法导入'
        });
        return;
      }
      var rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      var parsed = QaCore.parseExcelRows(rows);
      var pairs = parsed.pairs;
      var errors = parsed.errors;
      if (errors.length) {
        QaDialog.alert(errors.slice(0, 8).join('\n'), {
          type: 'error',
          title: '导入校验失败'
        });
        return;
      }
      if (!pairs.length) {
        QaDialog.alert('文件中没有可导入的有效数据。', { type: 'warning', title: '无有效数据' });
        return;
      }
      QaDialog.confirm(
        '将导入 ' +
          pairs.length +
          ' 条，并替换当前工作区（当前 ' +
          state.workspace.pairs.length +
          ' 条）。此操作不可撤销。',
        {
          title: '确认导入',
          confirmText: '开始导入',
          type: 'warning'
        }
      ).then(function (ok) {
        if (!ok) return;
        state.workspace.pairs = pairs;
        rebuildWorkspace();
        state.selected.clear();
        state.page = 1;
        persistWorkspace();
        renderAll();
        closeImportModal();
        QaDialog.alert('已成功导入 ' + pairs.length + ' 条 QA 对。', {
          type: 'success',
          title: '导入完成'
        });
      });
    };
    reader.readAsArrayBuffer(file);
  }

  function bindImportModalEvents() {
    $('#btn-import-xlsx').addEventListener('click', openImportModal);
    $('#modal-import-close').addEventListener('click', closeImportModal);
    $('#modal-import-cancel').addEventListener('click', closeImportModal);
    $('#modal-import').addEventListener('click', function (e) {
      if (e.target === $('#modal-import')) closeImportModal();
    });
    $('#btn-download-template').addEventListener('click', downloadImportTemplate);
    $('#btn-import-start').addEventListener('click', function () {
      if (importPendingFile) importExcelFile(importPendingFile);
    });

    var dropzone = $('#import-dropzone');
    var fileInput = $('#file-import');

    dropzone.addEventListener('click', function (e) {
      if (e.target.id === 'file-import') return;
      fileInput.click();
    });

    dropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    fileInput.addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) setImportPendingFile(f);
    });

    ['dragenter', 'dragover'].forEach(function (type) {
      dropzone.addEventListener(type, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('is-dragover');
      });
    });

    ['dragleave', 'drop'].forEach(function (type) {
      dropzone.addEventListener(type, function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('is-dragover');
      });
    });

    dropzone.addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) setImportPendingFile(f);
    });
  }

  function resolveDataUrl() {
    return new URL(DATA_URL, window.location.href).href;
  }

  function applyWorkspaceData(data) {
    state.workspace = QaCore.buildWorkspace(data.pairs || [], data.version);
    persistWorkspace();
    renderAll();
  }

  function loadFromSeed() {
    var seed = window.__QA_WORKSPACE_SEED__;
    if (!seed || !seed.pairs || !seed.pairs.length) return false;
    applyWorkspaceData(seed);
    return true;
  }

  function loadFromServer() {
    if (location.protocol === 'file:') {
      if (loadFromSeed()) return Promise.resolve();
      return Promise.reject(
        new Error(
          '不能用双击 HTML 的方式打开。请在仓库根目录执行 npx serve -l 3456 -c serve.json，再访问 http://localhost:3456/pc-v1.0.0/index.html'
        )
      );
    }
    return fetch(resolveDataUrl(), { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        applyWorkspaceData(data);
      })
      .catch(function (err) {
        if (loadFromSeed()) return;
        throw err;
      });
  }

  function initEditorOptions() {
    var aSel = $('#field-a');
    aSel.innerHTML = QaFeatureIds.FEATURE_NAMES.map(function (n) {
      return '<option value="' + escapeHtml(n) + '">' + escapeHtml(n) + '</option>';
    }).join('');
    var fSel = $('#filter-a');
    fSel.innerHTML =
      '<option value="">全部主功能</option>' +
      QaFeatureIds.FEATURE_NAMES.map(function (n) {
        return '<option value="' + escapeHtml(n) + '">' + escapeHtml(n) + '</option>';
      }).join('');
  }

  function bindEvents() {
    $('#btn-add').addEventListener('click', function () {
      openEditor(null);
    });
    $('#btn-export-xlsx').addEventListener('click', exportExcel);
    bindImportModalEvents();

    $('#filter-a').addEventListener('change', function (e) {
      state.filters.a = e.target.value;
      state.page = 1;
      renderTable();
    });
    $('#filter-pair-type').addEventListener('change', function (e) {
      state.filters.pairType = e.target.value;
      updateFilterAVisibility();
      state.page = 1;
      renderTable();
    });
    $('#filter-status').addEventListener('change', function (e) {
      state.filters.status = e.target.value;
      state.page = 1;
      renderTable();
    });
    $('#filter-multi').addEventListener('change', function (e) {
      state.filters.multiOnly = e.target.checked;
      if (state.filters.multiOnly) {
        state.sortBy = 'id';
        state.sortDir = 'asc';
      }
      state.page = 1;
      renderTable();
    });
    $('#filter-q').addEventListener('input', function (e) {
      state.filters.q = e.target.value;
      state.page = 1;
      renderTable();
    });

    $('#btn-reset-filters').addEventListener('click', function () {
      state.filters = { a: '', status: '', pairType: '', multiOnly: false, q: '' };
      $('#filter-a').value = '';
      $('#filter-pair-type').value = '';
      $('#filter-status').value = '';
      $('#filter-multi').checked = false;
      $('#filter-q').value = '';
      updateFilterAVisibility();
      state.page = 1;
      renderTable();
    });

    $('#btn-trial-toggle').addEventListener('click', function () {
      openTrialModal(true);
    });

    $('#tab-list').addEventListener('click', function () {
      state.view = 'list';
      state.page = 1;
      $('#tab-list').classList.add('is-active');
      $('#tab-multi').classList.remove('is-active');
      renderTable();
    });
    $('#tab-multi').addEventListener('click', function () {
      state.view = 'multi';
      state.page = 1;
      $('#tab-multi').classList.add('is-active');
      $('#tab-list').classList.remove('is-active');
      renderTable();
    });

    $('#btn-prev').addEventListener('click', function () {
      state.page--;
      renderTable();
    });
    $('#btn-next').addEventListener('click', function () {
      state.page++;
      renderTable();
    });

    $('#qa-table-head').addEventListener('change', function (e) {
      if (e.target.id === 'check-all') onCheckAllChange(e);
    });

    $('#qa-table-head').addEventListener('click', function (e) {
      var th = e.target.closest('[data-sort]');
      if (!th || th.classList.contains('is-disabled')) return;
      toggleSort(th.getAttribute('data-sort'));
    });

    $('#btn-batch-delete').addEventListener('click', function () {
      deleteIndices(Array.from(state.selected));
    });

    $('#qa-table-body').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      var idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (action === 'edit') openEditor(idx);
      if (action === 'duplicate') duplicatePair(idx);
      if (action === 'go-live') {
        if (setPairStatus(idx, QaCore.STATUS.PUBLISHED)) {
          QaDialog.alert('该 QA 对已上线，将参与试跑匹配。', { type: 'success', title: '已上线' });
        }
      }
      if (action === 'go-offline') {
        QaDialog.confirm('下线后将不参与试跑匹配。', {
          title: '确定下线该 QA 对？',
          confirmText: '下线',
          danger: true
        }).then(function (ok) {
          if (ok && setPairStatus(idx, QaCore.STATUS.OFFLINE)) {
            QaDialog.alert('该 QA 对已下线。', { type: 'success', title: '已下线' });
          }
        });
      }
      if (action === 'delete') deleteIndices([idx]);
      if (action === 'filter-q') {
        state.view = 'list';
        $('#tab-list').classList.add('is-active');
        $('#tab-multi').classList.remove('is-active');
        state.filters.q = btn.getAttribute('data-q');
        $('#filter-q').value = state.filters.q;
        state.page = 1;
        renderTable();
      }
    });

    $('#qa-table-body').addEventListener('change', function (e) {
      if (!e.target.classList.contains('row-check')) return;
      var idx = parseInt(e.target.getAttribute('data-idx'), 10);
      if (e.target.checked) state.selected.add(idx);
      else state.selected.delete(idx);
      $('#page-info').textContent = $('#page-info').textContent.replace(/已选 \d+ 条/, '已选 ' + state.selected.size + ' 条');
    });

    $('#btn-trial').addEventListener('click', function () {
      runTrial();
    });
    $('#trial-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') runTrial();
    });

    $('#modal-trial-close').addEventListener('click', closeTrialModal);
    $('#modal-trial').addEventListener('click', function (e) {
      if (e.target === $('#modal-trial')) closeTrialModal();
    });

    $('#drawer-close').addEventListener('click', closeEditor);
    $('#drawer-backdrop').addEventListener('click', closeEditor);
    $('#editor-cancel').addEventListener('click', closeEditor);
    $('#editor-save').addEventListener('click', saveEditor);
    $('#field-pair-type').addEventListener('change', syncEditorPairTypeUI);
  }

  function boot() {
    initEditorOptions();
    bindEvents();
    updateFilterAVisibility();
    var local = QaCore.loadLocal();
    if (local && local.pairs && local.pairs.length) {
      state.workspace = QaCore.buildWorkspace(local.pairs, local.version);
      renderAll();
      return;
    }
    loadFromServer().catch(function (err) {
      QaDialog.alert('加载 data/qa-workspace.json 失败：' + err.message, {
        type: 'error',
        title: '数据加载失败'
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
