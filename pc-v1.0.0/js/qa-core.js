/** QA 工作区：校验、multi-Q、排序、导出 payload */
(function (global) {
  var STORAGE_KEY = 'pc-qa-workspace-v1';

  var STATUS = {
    DRAFT: 'draft',
    PUBLISHED: 'published',
    OFFLINE: 'offline'
  };

  function statusLabel(status) {
    if (status === STATUS.DRAFT) return '草稿';
    if (status === STATUS.OFFLINE) return '已下线';
    return '已上线';
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

  function enrichPair(pair) {
    var p = Object.assign({}, pair);
    delete p.group;
    p.aId = global.QaFeatureIds.nameToId(p.a) || p.aId || '';
    if (!p.status) p.status = 'published';
    return p;
  }

  function enrichPairs(pairs) {
    return (pairs || []).map(enrichPair);
  }

  function buildMultiQ(pairs) {
    var byQ = {};
    pairs.forEach(function (p) {
      if (!p.q) return;
      if (!byQ[p.q]) byQ[p.q] = [];
      if (byQ[p.q].indexOf(p.a) < 0) byQ[p.q].push(p.a);
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

  /** 默认：按数据序号（id） */
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
      if (a.a !== b.a) return a.a.localeCompare(b.a, 'zh-CN');
      return a.q.localeCompare(b.q, 'zh-CN');
    });
  }

  /** 勾选「仅歧义 Q」时：先按 Q 再按 A，便于同一 Q 的多条记录相邻展示 */
  function sortPairsMultiFilter(pairs) {
    return pairs.slice().sort(function (a, b) {
      if (a.q !== b.q) return a.q.localeCompare(b.q, 'zh-CN');
      return a.a.localeCompare(b.a, 'zh-CN');
    });
  }

  function validatePair(pair, pairs, skipIndex) {
    var errors = [];
    if (!pair.q || !String(pair.q).trim()) errors.push('Q 不能为空');
    if (!pair.a || !String(pair.a).trim()) errors.push('A 不能为空');
    else if (!global.QaFeatureIds.isValidName(pair.a)) errors.push('未知功能 A：' + pair.a);
    (pairs || []).forEach(function (p, i) {
      if (skipIndex != null && i === skipIndex) return;
      if (p.q === pair.q && p.a === pair.a) {
        errors.push('与第 ' + (p.id || i + 1) + ' 行重复');
      }
    });
    return errors;
  }

  function validateAll(pairs) {
    var errors = [];
    pairs.forEach(function (p, i) {
      var rowErrors = validatePair(p, pairs, i);
      if (rowErrors.length) errors.push('第 ' + (p.id || i + 1) + ' 行：' + rowErrors.join('；'));
    });
    return errors;
  }

  function buildWorkspace(pairs, version) {
    var enriched = enrichPairs(pairs);
    return {
      version: version || 'v1.5.0',
      algorithm: 'C',
      updatedAt: new Date().toISOString(),
      pairs: enriched,
      multiQ: buildMultiQ(enriched),
      featureIds: global.QaFeatureIds.FEATURE_IDS
    };
  }

  function pairsForMatch(pairs) {
    return enrichPairs(pairs)
      .filter(function (p) {
        return isLiveStatus(p.status);
      })
      .map(function (p) {
        return { q: p.q, a: p.a, aId: p.aId, note: p.note, status: p.status };
      });
  }

  function emitIntentQaJs(workspace) {
    var payload = {
      version: workspace.version,
      source: 'QA对-主功能口语映射-' + workspace.version + '.xlsx',
      generatedAt: new Date().toISOString(),
      algorithm: workspace.algorithm || 'C',
      pairCount: workspace.pairs.length,
      uniqueQCount: new Set(workspace.pairs.map(function (p) {
        return p.q;
      })).size,
      pairs: workspace.pairs
        .filter(function (p) {
          return isLiveStatus(p.status);
        })
        .map(function (p) {
          return {
            q: p.q,
            a: p.a,
            aId: p.aId,
            note: p.note || ''
          };
        }),
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

  function parseExcelRows(rows) {
    var header = (rows[0] || []).map(function (c) {
      return String(c || '').trim();
    });
    var hasGroupCol = header.indexOf('分组') >= 0;
    var noteIdx = hasGroupCol ? 4 : 3;
    var pairs = [];
    var errors = [];

    rows.slice(1).forEach(function (row, i) {
      if (!row || !row.some(Boolean)) return;
      var id = row[0];
      var q = String(row[1] || '').trim();
      var a = String(row[2] || '').trim();
      var note = String(row[noteIdx] || '').trim();
      if (!q || !a) {
        errors.push('第 ' + (i + 2) + ' 行 Q/A 为空');
        return;
      }
      if (!global.QaFeatureIds.isValidName(a)) {
        errors.push('第 ' + (i + 2) + ' 行未知 A=' + a);
        return;
      }
      pairs.push(
        enrichPair({
          id: id || i + 1,
          q: q,
          a: a,
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
    statusLabel: statusLabel,
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
    emitIntentQaJs: emitIntentQaJs,
    parseExcelRows: parseExcelRows,
    saveLocal: saveLocal,
    loadLocal: loadLocal,
    clearLocal: clearLocal
  };
})(typeof window !== 'undefined' ? window : globalThis);
