/* PC 意图 QA 对维护 · v1.0.0 */
(function () {
  'use strict';

  var PAGE_SIZE = 10;
  var DATA_URL = 'data/qa-workspace.json';

  var state = {
    workspace: null,
    sortBy: 'id',
    sortDir: 'asc',
    filters: { a: '', status: '', pairType: '', role: '', q: '', categoryId: 'all' },
    categoryKeyword: '',
    categoryEditorId: null,
    /** 收起的分类 id；未收录则视为展开 */
    categoryCollapsed: new Set(),
    page: 1,
    selected: new Set(),
    editorIndex: null,
    editorFeatures: []
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
    var cls = 'type-tag type-tag--function';
    if (pt === QaCore.PAIR_TYPE.KNOWLEDGE) cls = 'type-tag type-tag--knowledge';
    else if (pt === QaCore.PAIR_TYPE.MIXED) cls = 'type-tag type-tag--mixed';
    return '<span class="' + cls + '">' + escapeHtml(QaCore.pairTypeLabel(pt)) + '</span>';
  }

  function aCellHtml(p) {
    var reply = p.reply || '';
    var features = QaCore.normalizeFeatures(p.features != null ? p.features : p.feature);
    var parts = [];
    if (reply) {
      parts.push(
        '<div class="col-a-text" title="' + escapeHtml(reply) + '">' + escapeHtml(reply) + '</div>'
      );
    }
    if (features.length) {
      parts.push(
        '<div class="col-a-feature">' + features.map(tagHtml).join(' ') + '</div>'
      );
    }
    if (!parts.length) parts.push('<span class="muted">—</span>');
    return '<td class="col-a-cell">' + parts.join('') + '</td>';
  }

  function renderEditorFeatures() {
    var box = $('#feature-selected');
    var addSel = $('#field-feature-add');
    if (!box || !addSel) return;
    var selected = state.editorFeatures.slice();
    box.innerHTML = selected
      .map(function (name, i) {
        return (
          '<div class="feature-picker__item" data-idx="' +
          i +
          '">' +
          tagHtml(name) +
          '<div class="feature-picker__ops">' +
          '<button type="button" class="icon-btn" data-feature-op="up" data-idx="' +
          i +
          '" title="上移"' +
          (i === 0 ? ' disabled' : '') +
          '>↑</button>' +
          '<button type="button" class="icon-btn" data-feature-op="down" data-idx="' +
          i +
          '" title="下移"' +
          (i >= selected.length - 1 ? ' disabled' : '') +
          '>↓</button>' +
          '<button type="button" class="icon-btn" data-feature-op="remove" data-idx="' +
          i +
          '" title="移除">×</button>' +
          '</div></div>'
        );
      })
      .join('');
    var remain = QaFeatureIds.FEATURE_NAMES.filter(function (n) {
      return selected.indexOf(n) < 0;
    });
    addSel.innerHTML =
      '<option value="">添加关联功能…</option>' +
      remain
        .map(function (n) {
          return '<option value="' + escapeHtml(n) + '">' + escapeHtml(n) + '</option>';
        })
        .join('');
    addSel.disabled = remain.length === 0;
  }

  function moveEditorFeature(from, to) {
    if (to < 0 || to >= state.editorFeatures.length) return;
    var list = state.editorFeatures.slice();
    var item = list.splice(from, 1)[0];
    list.splice(to, 0, item);
    state.editorFeatures = list;
    renderEditorFeatures();
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

  function persistWorkspace() {
    if (state.workspace) QaCore.saveLocal(state.workspace);
  }

  function rebuildWorkspace() {
    state.workspace = QaCore.buildWorkspace(
      state.workspace.pairs,
      state.workspace.version,
      state.workspace.categories
    );
  }

  function countPairsInSubtree(categoryId) {
    var ids = QaCore.getDescendantCategoryIds(state.workspace.categories, categoryId);
    var set = {};
    ids.forEach(function (id) {
      set[id] = true;
    });
    var n = 0;
    (state.workspace.pairs || []).forEach(function (p) {
      if (p.categoryId != null && p.categoryId !== '' && set[String(p.categoryId)]) n += 1;
    });
    return n;
  }

  function countUncategorizedPairs() {
    var n = 0;
    (state.workspace.pairs || []).forEach(function (p) {
      if (p.categoryId == null || p.categoryId === '') n += 1;
    });
    return n;
  }

  function isCategoryCollapsed(id) {
    return state.categoryCollapsed.has(String(id));
  }

  function toggleCategoryExpand(id) {
    var sid = String(id);
    if (state.categoryCollapsed.has(sid)) state.categoryCollapsed.delete(sid);
    else state.categoryCollapsed.add(sid);
    renderCategoryList();
  }

  /** 搜索时自动展开匹配路径上的祖先 */
  function ensureAncestorsExpanded(categoryId) {
    var id = String(categoryId || '');
    var guard = 0;
    while (id && guard < 32) {
      var cat = QaCore.findCategory(state.workspace.categories, id);
      if (!cat) break;
      var parentId = QaCore.normalizeParentId(cat.parentId);
      if (parentId) state.categoryCollapsed.delete(parentId);
      id = parentId;
      guard += 1;
    }
  }

  function isHiddenByCollapse(cat) {
    var parentId = QaCore.normalizeParentId(cat.parentId);
    var guard = 0;
    while (parentId && guard < 32) {
      if (isCategoryCollapsed(parentId)) return true;
      var parent = QaCore.findCategory(state.workspace.categories, parentId);
      if (!parent) break;
      parentId = QaCore.normalizeParentId(parent.parentId);
      guard += 1;
    }
    return false;
  }

  function renderCategoryList() {
    var box = $('#category-list');
    if (!box || !state.workspace) return;
    var kw = (state.categoryKeyword || '').trim().toLowerCase();
    var searching = !!kw;
    var total = state.workspace.pairs.length;
    var html = '';

    function matchKw(code, name) {
      if (!kw) return true;
      return (
        String(code || '').toLowerCase().indexOf(kw) >= 0 ||
        String(name || '').toLowerCase().indexOf(kw) >= 0
      );
    }

    if (matchKw('', '全部')) {
      html +=
        '<li class="category-list__row">' +
        '<span class="category-list__twist category-list__twist--spacer" aria-hidden="true"></span>' +
        '<button type="button" class="category-list__item' +
        (state.filters.categoryId === 'all' ? ' is-active' : '') +
        '" data-category-id="all">' +
        '<span class="category-list__main"><span class="category-list__name">全部</span></span>' +
        '<span class="category-list__count">' +
        total +
        '</span></button></li>';
    }
    if (matchKw('', '未分类')) {
      html +=
        '<li class="category-list__row">' +
        '<span class="category-list__twist category-list__twist--spacer" aria-hidden="true"></span>' +
        '<button type="button" class="category-list__item' +
        (state.filters.categoryId === 'uncategorized' ? ' is-active' : '') +
        '" data-category-id="uncategorized">' +
        '<span class="category-list__main"><span class="category-list__name">未分类</span></span>' +
        '<span class="category-list__count">' +
        countUncategorizedPairs() +
        '</span></button></li>';
    }

    var flat = QaCore.flattenCategoryTree(state.workspace.categories);
    if (searching) {
      flat.forEach(function (node) {
        if (matchKw(node.cat.code, node.cat.name)) {
          ensureAncestorsExpanded(node.cat.id);
        }
      });
      flat = flat.filter(function (node) {
        return matchKw(node.cat.code, node.cat.name) || !isHiddenByCollapse(node.cat);
      });
      // 搜索时：匹配节点及其可见祖先都展示
      var keep = {};
      flat.forEach(function (node) {
        if (!matchKw(node.cat.code, node.cat.name)) return;
        keep[String(node.cat.id)] = true;
        var pid = QaCore.normalizeParentId(node.cat.parentId);
        var g = 0;
        while (pid && g < 32) {
          keep[pid] = true;
          var p = QaCore.findCategory(state.workspace.categories, pid);
          if (!p) break;
          pid = QaCore.normalizeParentId(p.parentId);
          g += 1;
        }
      });
      flat = QaCore.flattenCategoryTree(state.workspace.categories).filter(function (node) {
        return keep[String(node.cat.id)];
      });
    }

    flat.forEach(function (node) {
      var c = node.cat;
      var id = String(c.id);
      if (!searching && isHiddenByCollapse(c)) return;
      var active = state.filters.categoryId === id;
      var children = QaCore.getChildCategories(state.workspace.categories, id);
      var hasChildren = children.length > 0;
      var expanded = !isCategoryCollapsed(id);
      var pad = Math.min(node.depth, 6) * 14;
      var twist = hasChildren
        ? '<button type="button" class="category-list__twist' +
          (expanded ? ' is-expanded' : '') +
          '" data-category-toggle="' +
          escapeHtml(id) +
          '" title="' +
          (expanded ? '收起' : '展开') +
          '" aria-label="' +
          (expanded ? '收起' : '展开') +
          '" style="margin-left:' +
          pad +
          'px">' +
          (expanded ? '▼' : '▶') +
          '</button>'
        : '<span class="category-list__twist category-list__twist--spacer" aria-hidden="true" style="margin-left:' +
          pad +
          'px"></span>';
      html +=
        '<li class="category-list__row' +
        (active ? ' is-active-row' : '') +
        '">' +
        twist +
        '<button type="button" class="category-list__item' +
        (active ? ' is-active' : '') +
        '" data-category-id="' +
        escapeHtml(id) +
        '">' +
        '<span class="category-list__main">' +
        '<span class="category-list__code">[' +
        escapeHtml(c.code) +
        ']</span>' +
        '<span class="category-list__name">' +
        escapeHtml(c.name) +
        '</span></span>' +
        '<span class="category-list__count">' +
        countPairsInSubtree(id) +
        '</span></button>' +
        '<div class="category-list__ops">' +
        '<button type="button" class="link-action link-action--muted" data-category-op="edit" data-category-id="' +
        escapeHtml(id) +
        '">修改</button>' +
        '<button type="button" class="link-action" data-category-op="delete" data-category-id="' +
        escapeHtml(id) +
        '">删除</button>' +
        '</div></li>';
    });

    if (!html) {
      html = '<li class="category-list__empty">无匹配分类</li>';
    }
    box.innerHTML = html;
  }

  function fillCategorySelect(selectedId) {
    var sel = $('#field-category');
    if (!sel) return;
    var opts =
      '<option value="">未分类</option>' +
      QaCore.flattenCategoryTree(state.workspace.categories)
        .map(function (node) {
          return (
            '<option value="' +
            escapeHtml(String(node.cat.id)) +
            '">' +
            escapeHtml(QaCore.categoryLabel(node.cat, node.depth)) +
            '</option>'
          );
        })
        .join('');
    sel.innerHTML = opts;
    sel.value = selectedId == null || selectedId === '' ? '' : String(selectedId);
  }

  function fillCategoryParentSelect(selectedParentId, editingId) {
    var sel = $('#field-category-parent');
    if (!sel) return;
    var banned = editingId
      ? QaCore.getDescendantCategoryIds(state.workspace.categories, editingId)
      : [];
    var bannedSet = {};
    banned.forEach(function (id) {
      bannedSet[id] = true;
    });
    var opts = '<option value="">无（作为一级分类）</option>';
    QaCore.flattenCategoryTree(state.workspace.categories).forEach(function (node) {
      var id = String(node.cat.id);
      if (bannedSet[id]) return;
      opts +=
        '<option value="' +
        escapeHtml(id) +
        '">' +
        escapeHtml(QaCore.categoryLabel(node.cat, node.depth)) +
        '</option>';
    });
    sel.innerHTML = opts;
    var parent = QaCore.normalizeParentId(selectedParentId);
    if (parent && !bannedSet[parent]) sel.value = parent;
    else sel.value = '';
  }

  function openCategoryEditor(id) {
    state.categoryEditorId = id == null ? null : String(id);
    var isNew = state.categoryEditorId == null;
    var defaultParent = '';
    if (
      isNew &&
      state.filters.categoryId &&
      state.filters.categoryId !== 'all' &&
      state.filters.categoryId !== 'uncategorized'
    ) {
      defaultParent = String(state.filters.categoryId);
    }
    var cat = isNew
      ? {
          code: QaCore.nextCategoryCode(state.workspace.categories),
          name: '',
          parentId: defaultParent
        }
      : QaCore.findCategory(state.workspace.categories, state.categoryEditorId) || {
          code: '',
          name: '',
          parentId: ''
        };
    $('#category-editor-title').textContent = isNew ? '新增分类' : '修改分类';
    fillCategoryParentSelect(cat.parentId, state.categoryEditorId);
    $('#field-category-code').value = cat.code || '';
    $('#field-category-name').value = cat.name || '';
    $('#category-editor-error').textContent = '';
    $('#modal-category').classList.add('is-open');
    $('#field-category-name').focus();
  }

  function closeCategoryEditor() {
    state.categoryEditorId = null;
    $('#modal-category').classList.remove('is-open');
  }

  function saveCategoryEditor() {
    var code = $('#field-category-code').value.trim();
    var name = $('#field-category-name').value.trim();
    var parentId = QaCore.normalizeParentId($('#field-category-parent').value);
    var draft = { code: code, name: name, parentId: parentId };
    var errors = QaCore.validateCategory(
      draft,
      state.workspace.categories,
      state.categoryEditorId
    );
    if (errors.length) {
      $('#category-editor-error').textContent = errors.join('；');
      return;
    }
    if (state.categoryEditorId == null) {
      state.workspace.categories.push(
        QaCore.enrichCategory({
          id: QaCore.nextCategoryId(state.workspace.categories),
          code: code,
          name: name,
          parentId: parentId
        })
      );
    } else {
      var target = QaCore.findCategory(state.workspace.categories, state.categoryEditorId);
      if (!target) {
        $('#category-editor-error').textContent = '分类不存在';
        return;
      }
      target.code = code;
      target.name = name;
      target.parentId = parentId;
    }
    rebuildWorkspace();
    persistWorkspace();
    closeCategoryEditor();
    renderAll();
  }

  function deleteCategory(id) {
    var cat = QaCore.findCategory(state.workspace.categories, id);
    if (!cat) return;
    var childCount = QaCore.getChildCategories(state.workspace.categories, id).length;
    if (childCount) {
      QaDialog.alert('请先删除或移走其子分类（共 ' + childCount + ' 个），再删除本分类。', {
        type: 'warning',
        title: '无法删除'
      });
      return;
    }
    var count = state.workspace.pairs.filter(function (p) {
      return String(p.categoryId || '') === String(id);
    }).length;
    var msg =
      '确定删除分类「[' +
      cat.code +
      '] ' +
      cat.name +
      '」？' +
      (count ? '\n其下 ' + count + ' 条 QA 对将变为未分类。' : '');
    QaDialog.confirm(msg, {
      title: '删除分类',
      confirmText: '删除',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      state.workspace.categories = state.workspace.categories.filter(function (c) {
        return String(c.id) !== String(id);
      });
      state.workspace.pairs.forEach(function (p) {
        if (String(p.categoryId || '') === String(id)) p.categoryId = '';
      });
      if (state.filters.categoryId === String(id)) state.filters.categoryId = 'all';
      rebuildWorkspace();
      persistWorkspace();
      renderAll();
    });
  }

  function comparePairIds(a, b) {
    var ia = parseInt(a.id, 10);
    var ib = parseInt(b.id, 10);
    if (!isNaN(ia) && !isNaN(ib) && ia !== ib) return ia - ib;
    return String(a.id || '').localeCompare(String(b.id || ''));
  }

  function applyListSort(pairs) {
    var dir = state.sortDir === 'desc' ? -1 : 1;
    return pairs.slice().sort(function (a, b) {
      var cmp = 0;
      if (state.sortBy === 'id') cmp = comparePairIds(a, b);
      else if (state.sortBy === 'q') cmp = a.q.localeCompare(b.q, 'zh-CN');
      else if (state.sortBy === 'a') {
        cmp = QaCore.featuresKey(a.features || a.feature || a.reply || a.a || '').localeCompare(
          QaCore.featuresKey(b.features || b.feature || b.reply || b.a || ''),
          'zh-CN'
        );
      }
      if (cmp !== 0) return cmp * dir;
      if (state.sortBy !== 'q') {
        cmp = a.q.localeCompare(b.q, 'zh-CN');
        if (cmp !== 0) return cmp;
      }
      if (state.sortBy !== 'a') {
        cmp = QaCore.featuresKey(a.features || a.feature || a.reply || a.a || '').localeCompare(
          QaCore.featuresKey(b.features || b.feature || b.reply || b.a || ''),
          'zh-CN'
        );
        if (cmp !== 0) return cmp;
      }
      return comparePairIds(a, b);
    });
  }

  function getFilteredPairs() {
    var f = state.filters;
    var categorySet = null;
    if (f.categoryId && f.categoryId !== 'all' && f.categoryId !== 'uncategorized') {
      categorySet = {};
      QaCore.getDescendantCategoryIds(state.workspace.categories, f.categoryId).forEach(function (id) {
        categorySet[id] = true;
      });
    }
    var filtered = state.workspace.pairs.filter(function (p) {
      if (f.categoryId === 'uncategorized') {
        if (p.categoryId != null && p.categoryId !== '') return false;
      } else if (categorySet) {
        if (!p.categoryId || !categorySet[String(p.categoryId)]) return false;
      }
      if (f.pairType) {
        var want = QaCore.normalizePairType(f.pairType);
        var pt = QaCore.normalizePairType(p.pairType);
        if (want === QaCore.PAIR_TYPE.FUNCTION) {
          if (pt !== QaCore.PAIR_TYPE.FUNCTION && pt !== QaCore.PAIR_TYPE.MIXED) return false;
        } else if (want === QaCore.PAIR_TYPE.KNOWLEDGE) {
          if (pt !== QaCore.PAIR_TYPE.KNOWLEDGE && pt !== QaCore.PAIR_TYPE.MIXED) return false;
        } else if (pt !== want) return false;
      }
      if (f.a) {
        var feats = QaCore.normalizeFeatures(p.features != null ? p.features : p.feature);
        if (feats.indexOf(f.a) < 0) return false;
      }
      if (f.role) {
        if (QaCore.normalizeRole(p.role) !== QaCore.normalizeRole(f.role)) return false;
      }
      if (f.status && p.status !== f.status) return false;
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
    var active = state.sortBy === field;
    var ascOn = active && state.sortDir === 'asc';
    var descOn = active && state.sortDir === 'desc';
    return (
      '<th class="col-sortable' +
      (extraClass ? ' ' + extraClass : '') +
      (active ? ' is-active' : '') +
      '" data-sort="' +
      field +
      '" title="点击切换排序">' +
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
      ['序号', '问题', '回复', '关联功能', '角色', '备注'],
      [1, '今天有哪些待跟进', '为您打开今日待跟进列表。', '今日待跟', '全部角色', ''],
      [
        2,
        '查一下订单',
        '订单可在进度中查看，也可确认下单。',
        '确认下单、订单进度',
        '全部角色',
        '多功能用顿号分隔，顺序即展示顺序'
      ]
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
    renderCategoryList();
    renderTable();
  }

  function renderTableHead() {
    var head = $('#qa-table-head');
    if (!head) return;
    head.innerHTML =
      '<tr>' +
      '<th class="col-check"><input type="checkbox" id="check-all" /></th>' +
      sortTh('序号', 'id', 'col-no') +
      sortTh('问题', 'q', 'col-q') +
      '<th>类型</th>' +
      sortTh('回复 / 关联功能', 'a') +
      '<th>角色</th>' +
      '<th>备注</th>' +
      '<th>状态</th>' +
      '<th class="col-actions">操作</th>' +
      '</tr>';
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
          '<td class="col-role">' +
          escapeHtml(p.role || QaCore.ROLE_ALL) +
          '</td>' +
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
      tbody.innerHTML = '<tr><td colspan="9" class="empty-cell">无匹配数据</td></tr>';
    }

    $('#page-info').textContent =
      '第 ' +
      state.page +
      ' / ' +
      totalPages +
      ' 页 · 共 ' +
      filtered.length +
      ' 条 · 已选 ' +
      state.selected.size +
      ' 条';
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
      reply: src.reply || '',
      features: QaCore.normalizeFeatures(src.features != null ? src.features : src.feature),
      categoryId: src.categoryId || '',
      role: src.role || QaCore.ROLE_ALL,
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
        hint.textContent = '';
        hint.hidden = true;
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
    return {
      id:
        state.editorIndex != null
          ? state.workspace.pairs[state.editorIndex].id
          : QaCore.nextId(state.workspace.pairs),
      q: $('#field-q').value.trim(),
      reply: $('#field-reply').value.trim(),
      features: state.editorFeatures.slice(),
      categoryId: ($('#field-category').value || '').trim(),
      role: QaCore.normalizeRole($('#field-role').value),
      note: $('#field-note').value.trim(),
      status: status
    };
  }

  function openEditor(index) {
    state.editorIndex = index;
    var isNew = index == null;
    var defaultCategoryId = '';
    if (
      isNew &&
      state.filters.categoryId &&
      state.filters.categoryId !== 'all' &&
      state.filters.categoryId !== 'uncategorized'
    ) {
      defaultCategoryId = String(state.filters.categoryId);
    }
    var p = isNew
      ? {
          id: QaCore.nextId(state.workspace.pairs),
          q: '',
          reply: '',
          features: [],
          categoryId: defaultCategoryId,
          role: QaCore.ROLE_ALL,
          note: '',
          status: QaCore.STATUS.DRAFT
        }
      : QaCore.enrichPair(state.workspace.pairs[index]);
    state.editorFeatures = QaCore.normalizeFeatures(
      p.features != null ? p.features : p.feature
    );
    $('#editor-title').textContent = isNew ? '新增 QA 对' : '编辑 QA 对';
    fillCategorySelect(p.categoryId);
    $('#field-role').value = QaCore.normalizeRole(p.role);
    $('#field-q').value = p.q || '';
    $('#field-reply').value = p.reply || '';
    $('#field-note').value = p.note || '';
    renderEditorFeatures();
    $('#editor-error').textContent = '';
    updateEditorFooter(isNew, p.status);
    $('#drawer').classList.add('is-open');
    $('#drawer-backdrop').classList.add('is-open');
  }

  function closeEditor() {
    state.editorIndex = null;
    state.editorFeatures = [];
    $('#drawer').classList.remove('is-open');
    $('#drawer-backdrop').classList.remove('is-open');
  }

  function commitEditorPair(pair, closeAfter) {
    var errors = QaCore.validatePair(pair, state.workspace.pairs, state.editorIndex, {
      form: true
    });
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
    var rows = [['序号', '问题', '回复', '关联功能', '角色', '备注']];
    QaCore.sortPairsById(state.workspace.pairs).forEach(function (p, i) {
      var feats = QaCore.normalizeFeatures(p.features != null ? p.features : p.feature);
      rows.push([
        p.id || i + 1,
        p.q,
        p.reply || '',
        feats.join('、'),
        p.role || QaCore.ROLE_ALL,
        p.note || ''
      ]);
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
    state.workspace = QaCore.buildWorkspace(
      data.pairs || [],
      data.version,
      data.categories
    );
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
    var roleSel = $('#field-role');
    roleSel.innerHTML = QaCore.ROLE_OPTIONS.map(function (n) {
      return '<option value="' + escapeHtml(n) + '">' + escapeHtml(n) + '</option>';
    }).join('');
    var filterRole = $('#filter-role');
    if (filterRole) {
      filterRole.innerHTML =
        '<option value="">全部角色</option>' +
        QaCore.ROLE_OPTIONS.filter(function (n) {
          return n !== QaCore.ROLE_ALL;
        })
          .map(function (n) {
            return '<option value="' + escapeHtml(n) + '">' + escapeHtml(n) + '</option>';
          })
          .join('') +
        '<option value="' +
        escapeHtml(QaCore.ROLE_ALL) +
        '">' +
        escapeHtml(QaCore.ROLE_ALL) +
        '</option>';
    }
    state.editorFeatures = [];
    renderEditorFeatures();
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
    $('#filter-role').addEventListener('change', function (e) {
      state.filters.role = e.target.value;
      state.page = 1;
      renderTable();
    });
    $('#filter-q').addEventListener('input', function (e) {
      state.filters.q = e.target.value;
      state.page = 1;
      renderTable();
    });

    $('#btn-reset-filters').addEventListener('click', function () {
      state.filters = {
        a: '',
        status: '',
        pairType: '',
        role: '',
        q: '',
        categoryId: state.filters.categoryId || 'all'
      };
      $('#filter-a').value = '';
      $('#filter-pair-type').value = '';
      $('#filter-status').value = '';
      $('#filter-role').value = '';
      $('#filter-q').value = '';
      updateFilterAVisibility();
      state.page = 1;
      renderTable();
    });

    $('#category-filter').addEventListener('input', function (e) {
      state.categoryKeyword = e.target.value;
      renderCategoryList();
    });
    $('#btn-category-add').addEventListener('click', function () {
      openCategoryEditor(null);
    });
    $('#category-list').addEventListener('click', function (e) {
      var toggleBtn = e.target.closest('[data-category-toggle]');
      if (toggleBtn) {
        e.preventDefault();
        e.stopPropagation();
        toggleCategoryExpand(toggleBtn.getAttribute('data-category-toggle'));
        return;
      }
      var opBtn = e.target.closest('[data-category-op]');
      if (opBtn) {
        e.preventDefault();
        e.stopPropagation();
        var op = opBtn.getAttribute('data-category-op');
        var cid = opBtn.getAttribute('data-category-id');
        if (op === 'edit') openCategoryEditor(cid);
        if (op === 'delete') deleteCategory(cid);
        return;
      }
      var item = e.target.closest('[data-category-id]');
      if (!item || !item.classList.contains('category-list__item')) return;
      var selectedId = item.getAttribute('data-category-id') || 'all';
      if (selectedId !== 'all' && selectedId !== 'uncategorized') {
        ensureAncestorsExpanded(selectedId);
      }
      state.filters.categoryId = selectedId;
      state.page = 1;
      renderAll();
    });
    $('#modal-category-close').addEventListener('click', closeCategoryEditor);
    $('#category-editor-cancel').addEventListener('click', closeCategoryEditor);
    $('#category-editor-save').addEventListener('click', saveCategoryEditor);
    $('#modal-category').addEventListener('click', function (e) {
      if (e.target === $('#modal-category')) closeCategoryEditor();
    });
    $('#field-category-name').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveCategoryEditor();
      }
    });

    $('#btn-trial-toggle').addEventListener('click', function () {
      openTrialModal(true);
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

    $('#field-feature-add').addEventListener('change', function (e) {
      var name = (e.target.value || '').trim();
      if (!name) return;
      if (state.editorFeatures.indexOf(name) < 0) {
        state.editorFeatures.push(name);
        renderEditorFeatures();
      } else {
        e.target.value = '';
      }
    });

    $('#feature-selected').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-feature-op]');
      if (!btn || btn.disabled) return;
      var op = btn.getAttribute('data-feature-op');
      var idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (isNaN(idx)) return;
      if (op === 'remove') {
        state.editorFeatures.splice(idx, 1);
        renderEditorFeatures();
      } else if (op === 'up') {
        moveEditorFeature(idx, idx - 1);
      } else if (op === 'down') {
        moveEditorFeature(idx, idx + 1);
      }
    });
  }

  function boot() {
    initEditorOptions();
    bindEvents();
    updateFilterAVisibility();
    var local = QaCore.loadLocal();
    if (local && local.pairs && local.pairs.length) {
      state.workspace = QaCore.buildWorkspace(local.pairs, local.version, local.categories);
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
