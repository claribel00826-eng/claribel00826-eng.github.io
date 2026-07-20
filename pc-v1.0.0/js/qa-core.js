/** QA 工作区：校验、multi-Q、排序、导出 payload */
(function (global) {
  var STORAGE_KEY = 'pc-qa-workspace-v1';

  var STATUS = {
    DRAFT: 'draft',
    PUBLISHED: 'published',
    OFFLINE: 'offline'
  };

  var PAIR_TYPE = {
    FUNCTION: 'function',
    KNOWLEDGE: 'knowledge',
    MIXED: 'mixed'
  };

  /** 角色枚举；空 / all / 全部角色 均表示全部角色 */
  var ROLE_ALL = '全部角色';
  var ROLE_OPTIONS = [ROLE_ALL, '销售', '销售主管', '管理员'];

  var DEFAULT_CATEGORIES = [
    { id: 1, code: '001', name: '跟进与客户' },
    { id: 2, code: '002', name: '方案与报价' },
    { id: 3, code: '003', name: '订单与交期' },
    { id: 4, code: '004', name: '经营分析' },
    { id: 5, code: '005', name: '通用知识' }
  ];

  function defaultCategories() {
    return DEFAULT_CATEGORIES.map(function (c) {
      return Object.assign({}, c);
    });
  }

  function enrichCategory(cat) {
    var c = Object.assign({}, cat || {});
    c.id = c.id == null || c.id === '' ? null : c.id;
    c.code = String(c.code == null ? '' : c.code).trim();
    c.name = String(c.name == null ? '' : c.name).trim();
    return c;
  }

  function enrichCategories(categories) {
    var source = categories == null ? defaultCategories() : categories;
    var list = (source || []).map(enrichCategory);
    return list
      .filter(function (c) {
        return c.id != null && c.name;
      })
      .sort(function (a, b) {
        return String(a.code || '').localeCompare(String(b.code || ''), 'zh-CN');
      });
  }

  function nextCategoryId(categories) {
    var max = 0;
    (categories || []).forEach(function (c) {
      var n = parseInt(c.id, 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return max + 1;
  }

  function nextCategoryCode(categories) {
    var max = 0;
    (categories || []).forEach(function (c) {
      var n = parseInt(c.code, 10);
      if (!isNaN(n) && n > max) max = n;
    });
    var s = String(max + 1);
    while (s.length < 3) s = '0' + s;
    return s;
  }

  function findCategory(categories, id) {
    if (id == null || id === '') return null;
    var sid = String(id);
    return (categories || []).find(function (c) {
      return String(c.id) === sid;
    }) || null;
  }

  function validateCategory(cat, categories, skipId) {
    var errors = [];
    var code = String(cat.code || '').trim();
    var name = String(cat.name || '').trim();
    if (!code) errors.push('分类编码不能为空');
    if (!name) errors.push('分类名称不能为空');
    (categories || []).forEach(function (c) {
      if (skipId != null && String(c.id) === String(skipId)) return;
      if (code && String(c.code) === code) errors.push('分类编码已存在：' + code);
      if (name && String(c.name) === name) errors.push('分类名称已存在：' + name);
    });
    return errors;
  }

  function statusLabel(status) {
    if (status === STATUS.DRAFT) return '草稿';
    if (status === STATUS.OFFLINE) return '已下线';
    return '已上线';
  }

  function pairTypeLabel(pairType) {
    var pt = normalizePairType(pairType);
    if (pt === PAIR_TYPE.KNOWLEDGE) return '知识';
    if (pt === PAIR_TYPE.MIXED) return '混合';
    return '功能';
  }

  function normalizePairType(value) {
    var s = String(value == null ? '' : value).trim();
    if (s === PAIR_TYPE.KNOWLEDGE || s === '知识') return PAIR_TYPE.KNOWLEDGE;
    if (s === PAIR_TYPE.MIXED || s === '混合') return PAIR_TYPE.MIXED;
    return PAIR_TYPE.FUNCTION;
  }

  function normalizeRole(value) {
    var s = String(value == null ? '' : value).trim();
    if (!s || s === 'all' || s === '全部' || s === ROLE_ALL) return ROLE_ALL;
    return s;
  }

  /** 规范化关联功能为有序去重数组 */
  function normalizeFeatures(value) {
    var list = [];
    if (Array.isArray(value)) {
      value.forEach(function (item) {
        var name = String(item == null ? '' : item).trim();
        if (name && list.indexOf(name) < 0) list.push(name);
      });
      return list;
    }
    var raw = String(value == null ? '' : value).trim();
    if (!raw) return list;
    raw.split(/[,，、|;；]+/).forEach(function (part) {
      var name = String(part || '').trim();
      if (name && list.indexOf(name) < 0) list.push(name);
    });
    return list;
  }

  function featuresKey(features) {
    return normalizeFeatures(features).join('\u0001');
  }

  function derivePairType(pair) {
    var features = normalizeFeatures(pair && (pair.features != null ? pair.features : pair.feature));
    var hasFeature = features.length > 0;
    var hasReply = !!(pair && String(pair.reply || '').trim());
    if (hasFeature && hasReply) return PAIR_TYPE.MIXED;
    if (hasFeature) return PAIR_TYPE.FUNCTION;
    return PAIR_TYPE.KNOWLEDGE;
  }

  function isFunctionPair(pair) {
    var pt = pair && pair.pairType != null ? normalizePairType(pair.pairType) : derivePairType(pair);
    return pt === PAIR_TYPE.FUNCTION || pt === PAIR_TYPE.MIXED;
  }

  function isKnowledgePair(pair) {
    var pt = pair && pair.pairType != null ? normalizePairType(pair.pairType) : derivePairType(pair);
    return pt === PAIR_TYPE.KNOWLEDGE || pt === PAIR_TYPE.MIXED;
  }

  function canDeletePair(pair) {
    return pair && pair.status !== STATUS.PUBLISHED;
  }

  function isLiveStatus(status) {
    return status === STATUS.PUBLISHED;
  }

  function normalizeQ(text) {
    return (text || '')
      .trim()
      .replace(/\s+/g, '')
      .replace(/[，,。.；;！!？?、]/g, '');
  }

  /** 将旧版 pairType+a / feature 字符串迁移为 reply + features[] */
  function migratePairShape(pair) {
    var p = Object.assign({}, pair);
    var hasReply = p.reply != null && String(p.reply).trim() !== '';
    var features = normalizeFeatures(p.features != null ? p.features : p.feature);
    if (!hasReply && !features.length) {
      var legacyType = normalizePairType(p.pairType);
      var a = String(p.a || '').trim();
      if (a) {
        if (legacyType === PAIR_TYPE.KNOWLEDGE) {
          p.reply = a;
          features = [];
        } else {
          features = [a];
          p.reply = '';
        }
      } else {
        p.reply = '';
      }
    } else if (!hasReply) {
      p.reply = '';
    }
    p.features = features;
    p.feature = features.join('、');
    p.role = normalizeRole(p.role);
    return p;
  }

  function enrichPair(pair) {
    var p = migratePairShape(pair);
    delete p.group;
    p.reply = String(p.reply || '').trim();
    p.features = normalizeFeatures(p.features);
    p.feature = p.features.join('、');
    p.role = normalizeRole(p.role);
    p.pairType = derivePairType(p);
    if (p.features.length) {
      p.a = p.features[0];
      p.aId = global.QaFeatureIds.nameToId(p.features[0]) || '';
      p.aIds = p.features.map(function (name) {
        return global.QaFeatureIds.nameToId(name) || '';
      });
    } else {
      p.a = p.reply;
      p.aId = '';
      p.aIds = [];
    }
    if (!p.status) p.status = 'published';
    if (p.categoryId == null || p.categoryId === '') p.categoryId = '';
    else p.categoryId = String(p.categoryId);
    return p;
  }

  function enrichPairs(pairs) {
    return (pairs || []).map(enrichPair);
  }

  function buildMultiQ(pairs) {
    var byQ = {};
    enrichPairs(pairs).forEach(function (p) {
      if (!p.q || !p.features || !p.features.length) return;
      if (!byQ[p.q]) byQ[p.q] = [];
      p.features.forEach(function (name) {
        if (byQ[p.q].indexOf(name) < 0) byQ[p.q].push(name);
      });
    });
    var multi = [];
    Object.keys(byQ)
      .sort()
      .forEach(function (q) {
        if (byQ[q].length >= 2) multi.push({ q: q, a: byQ[q] });
      });
    return multi;
  }

  function multiQSet(pairs) {
    var set = new Set();
    buildMultiQ(pairs).forEach(function (m) {
      set.add(m.q);
    });
    return set;
  }

  function nextId(pairs) {
    var max = 0;
    (pairs || []).forEach(function (p) {
      var n = parseInt(p.id, 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return max + 1;
  }

  function sortPairsById(pairs) {
    return pairs.slice().sort(function (a, b) {
      var ia = parseInt(a.id, 10);
      var ib = parseInt(b.id, 10);
      if (!isNaN(ia) && !isNaN(ib) && ia !== ib) return ia - ib;
      return String(a.id || '').localeCompare(String(b.id || ''));
    });
  }

  function sortPairs(pairs) {
    return pairs.slice().sort(function (a, b) {
      var aa = featuresKey(a.features || a.feature || a.a || '');
      var ba = featuresKey(b.features || b.feature || b.a || '');
      if (aa !== ba) return aa.localeCompare(ba, 'zh-CN');
      return a.q.localeCompare(b.q, 'zh-CN');
    });
  }

  function sortPairsMultiFilter(pairs) {
    return pairs.slice().sort(function (a, b) {
      if (a.q !== b.q) return a.q.localeCompare(b.q, 'zh-CN');
      var aa = featuresKey(a.features || a.feature || a.a || '');
      var ba = featuresKey(b.features || b.feature || b.a || '');
      return aa.localeCompare(ba, 'zh-CN');
    });
  }

  function samePairKey(a, b) {
    return (
      a.q === b.q &&
      String(a.reply || '') === String(b.reply || '') &&
      featuresKey(a.features || a.feature) === featuresKey(b.features || b.feature) &&
      normalizeRole(a.role) === normalizeRole(b.role)
    );
  }

  /**
   * @param {object} pair
   * @param {Array} pairs
   * @param {number|null} skipIndex
   * @param {{form?: boolean}} [opts] form=true 时回复必填；列表存量允许仅有关联功能
   */
  function validatePair(pair, pairs, skipIndex, opts) {
    opts = opts || {};
    var errors = [];
    var reply = String(pair.reply || '').trim();
    var features = normalizeFeatures(pair.features != null ? pair.features : pair.feature);
    if (!pair.q || !String(pair.q).trim()) errors.push('问题不能为空');
    if (opts.form) {
      if (!reply) errors.push('回复不能为空');
    } else if (!reply && !features.length) {
      errors.push('回复与关联功能至少填一项');
    }
    features.forEach(function (name) {
      if (!global.QaFeatureIds.isValidName(name)) {
        errors.push('未知关联功能：' + name);
      }
    });
    (pairs || []).forEach(function (p, i) {
      if (skipIndex != null && i === skipIndex) return;
      if (samePairKey(enrichPair(p), enrichPair(pair))) {
        errors.push('与第 ' + (p.id || i + 1) + ' 行重复');
      }
    });
    return errors;
  }

  function validateAll(pairs) {
    var errors = [];
    pairs.forEach(function (p, i) {
      var rowErrors = validatePair(p, pairs, i, { form: false });
      if (rowErrors.length) errors.push('第 ' + (p.id || i + 1) + ' 行：' + rowErrors.join('；'));
    });
    return errors;
  }

  function buildWorkspace(pairs, version, categories) {
    var enriched = enrichPairs(pairs);
    var cats = enrichCategories(categories);
    return {
      version: version || 'v1.5.0',
      algorithm: 'C',
      updatedAt: new Date().toISOString(),
      categories: cats,
      pairs: enriched,
      multiQ: buildMultiQ(enriched),
      featureIds: global.QaFeatureIds.FEATURE_IDS
    };
  }

  function pairsForMatch(pairs) {
    var out = [];
    enrichPairs(pairs).forEach(function (p) {
      if (!isLiveStatus(p.status) || !p.features.length) return;
      p.features.forEach(function (name) {
        out.push({
          q: p.q,
          a: name,
          aId: global.QaFeatureIds.nameToId(name) || '',
          note: p.note,
          role: p.role,
          status: p.status,
          pairType: PAIR_TYPE.FUNCTION
        });
      });
    });
    return out;
  }

  function pairsForKnowledgeMatch(pairs) {
    return enrichPairs(pairs)
      .filter(function (p) {
        return isLiveStatus(p.status) && !!p.reply;
      })
      .map(function (p) {
        return {
          q: p.q,
          a: p.reply,
          note: p.note,
          role: p.role,
          status: p.status,
          pairType: PAIR_TYPE.KNOWLEDGE
        };
      });
  }

  function emitIntentQaJs(workspace) {
    var live = workspace.pairs.filter(function (p) {
      return isLiveStatus(p.status);
    });
    var emitPairs = [];
    live.forEach(function (p) {
      (p.features || []).forEach(function (name) {
        emitPairs.push({
          q: p.q,
          a: name,
          aId: global.QaFeatureIds.nameToId(name) || '',
          pairType: PAIR_TYPE.FUNCTION,
          note: p.note || '',
          role: p.role || ROLE_ALL
        });
      });
      if (p.reply) {
        emitPairs.push({
          q: p.q,
          a: p.reply,
          pairType: PAIR_TYPE.KNOWLEDGE,
          note: p.note || '',
          role: p.role || ROLE_ALL
        });
      }
    });
    var payload = {
      version: workspace.version,
      source: 'QA对-主功能口语映射-' + workspace.version + '.xlsx',
      generatedAt: new Date().toISOString(),
      algorithm: workspace.algorithm || 'C',
      pairCount: emitPairs.length,
      uniqueQCount: new Set(
        emitPairs.map(function (p) {
          return p.q;
        })
      ).size,
      pairs: emitPairs,
      multiQ: workspace.multiQ,
      featureIds: global.QaFeatureIds.FEATURE_IDS
    };
    var body = JSON.stringify(payload, null, 2);
    return (
      '/** 自动生成 · 勿手改。源：' +
      payload.source +
      ' · PC QA 维护端导出 */\n' +
      '(function () {\n' +
      '  window.IntentQa = ' +
      body +
      ';\n' +
      '})();\n'
    );
  }

  function saveLocal(workspace) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function clearLocal() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function headerIndex(header, names) {
    for (var i = 0; i < names.length; i++) {
      var idx = header.indexOf(names[i]);
      if (idx >= 0) return idx;
    }
    return -1;
  }

  function parseExcelHeader(header) {
    return {
      idIdx: headerIndex(header, ['序号', '编号', 'id']),
      qIdx: headerIndex(header, ['问题', 'Q', 'Q（用户问题）', '用户说法 Q']),
      replyIdx: headerIndex(header, ['回复', '知识回复', '知识回复文案']),
      featureIdx: headerIndex(header, ['关联功能', '目标主功能', '主功能 A', 'A', 'A（系统功能）']),
      roleIdx: headerIndex(header, ['角色']),
      typeIdx: headerIndex(header, ['类型']),
      noteIdx: headerIndex(header, ['备注'])
    };
  }

  function parseExcelRows(rows) {
    var header = (rows[0] || []).map(function (c) {
      return String(c || '').trim();
    });
    var col = parseExcelHeader(header);
    var pairs = [];
    var errors = [];
    var isLegacyTypeSheet = col.replyIdx < 0 && col.typeIdx >= 0 && col.featureIdx >= 0;

    rows.slice(1).forEach(function (row, i) {
      if (!row || !row.some(Boolean)) return;
      var id = col.idIdx >= 0 ? row[col.idIdx] : i + 1;
      var q = col.qIdx >= 0 ? String(row[col.qIdx] || '').trim() : '';
      var note = col.noteIdx >= 0 ? String(row[col.noteIdx] || '').trim() : '';
      var role = col.roleIdx >= 0 ? row[col.roleIdx] : ROLE_ALL;
      var reply = '';
      var features = [];

      if (isLegacyTypeSheet) {
        var a = String(row[col.featureIdx] || '').trim();
        var pairType = normalizePairType(row[col.typeIdx]);
        if (pairType === PAIR_TYPE.KNOWLEDGE) reply = a;
        else if (a) features = [a];
      } else {
        reply = col.replyIdx >= 0 ? String(row[col.replyIdx] || '').trim() : '';
        features = col.featureIdx >= 0 ? normalizeFeatures(row[col.featureIdx]) : [];
      }

      if (!q || (!reply && !features.length)) {
        errors.push('第 ' + (i + 2) + ' 行问题/回复为空');
        return;
      }
      var badFeature = features.find(function (name) {
        return !global.QaFeatureIds.isValidName(name);
      });
      if (badFeature) {
        errors.push('第 ' + (i + 2) + ' 行未知关联功能=' + badFeature);
        return;
      }
      pairs.push(
        enrichPair({
          id: id || i + 1,
          q: q,
          reply: reply,
          features: features,
          role: role,
          note: note,
          status: 'published'
        })
      );
    });

    return { pairs: pairs, errors: errors };
  }

  global.QaCore = {
    STORAGE_KEY: STORAGE_KEY,
    STATUS: STATUS,
    PAIR_TYPE: PAIR_TYPE,
    ROLE_ALL: ROLE_ALL,
    ROLE_OPTIONS: ROLE_OPTIONS,
    defaultCategories: defaultCategories,
    enrichCategory: enrichCategory,
    enrichCategories: enrichCategories,
    nextCategoryId: nextCategoryId,
    nextCategoryCode: nextCategoryCode,
    findCategory: findCategory,
    validateCategory: validateCategory,
    statusLabel: statusLabel,
    pairTypeLabel: pairTypeLabel,
    normalizePairType: normalizePairType,
    normalizeRole: normalizeRole,
    normalizeFeatures: normalizeFeatures,
    featuresKey: featuresKey,
    derivePairType: derivePairType,
    isFunctionPair: isFunctionPair,
    isKnowledgePair: isKnowledgePair,
    canDeletePair: canDeletePair,
    isLiveStatus: isLiveStatus,
    normalizeQ: normalizeQ,
    enrichPair: enrichPair,
    enrichPairs: enrichPairs,
    buildMultiQ: buildMultiQ,
    multiQSet: multiQSet,
    nextId: nextId,
    sortPairsById: sortPairsById,
    sortPairs: sortPairs,
    sortPairsMultiFilter: sortPairsMultiFilter,
    validatePair: validatePair,
    validateAll: validateAll,
    buildWorkspace: buildWorkspace,
    pairsForMatch: pairsForMatch,
    pairsForKnowledgeMatch: pairsForKnowledgeMatch,
    emitIntentQaJs: emitIntentQaJs,
    parseExcelRows: parseExcelRows,
    saveLocal: saveLocal,
    loadLocal: loadLocal,
    clearLocal: clearLocal
  };
})(typeof window !== 'undefined' ? window : globalThis);
