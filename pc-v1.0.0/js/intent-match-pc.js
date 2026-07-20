/**
 * L0 主功能召回 · 方案 C（与 v1.5.0/js/intent-match.js 同构）
 */
(function (global) {
  var MIN_CONTAIN_LEN = 2;
  var FLOW_UTTERANCE_RE =
    /下一步|逐项|勾选|筛选|加购|模板|保存这个|确认需求|生成方案|保存方案|数量|规格|填价|第\d|第[一二三四五六七八九十]|报价\s*\d|单价\d/;
  var COMPOSITE_Q_RE = /[并,，、]|切换|然后|再/;

  function normalizeUtterance(text) {
    return (text || '')
      .trim()
      .replace(/\s+/g, '')
      .replace(/[，,。.；;！!？?、]/g, '');
  }

  function isContainedMatch(u, nq, opts) {
    opts = opts || {};
    if (!u || !nq) return false;
    if (u === nq) return true;
    if (opts.flowOnlyExact && FLOW_UTTERANCE_RE.test(u)) return false;
    if (u.length < MIN_CONTAIN_LEN && nq.length < MIN_CONTAIN_LEN) return false;
    if (u.length >= nq.length && nq.length >= MIN_CONTAIN_LEN && u.indexOf(nq) >= 0) {
      return true;
    }
    if (nq.length > u.length && u.length >= MIN_CONTAIN_LEN && nq.indexOf(u) >= 0) {
      if (COMPOSITE_Q_RE.test(nq)) return false;
      if (nq.length - u.length <= 4) return true;
    }
    return false;
  }

  function isFunctionRow(row) {
    if (!row) return true;
    var pt = row.pairType;
    return !pt || pt === 'function' || pt === '功能';
  }

  function isKnowledgeRow(row) {
    return row && (row.pairType === 'knowledge' || row.pairType === '知识');
  }

  function matchRows(text, pairs, rowFilter) {
    if (!pairs || !pairs.length) return [];
    var u = normalizeUtterance(text);
    if (!u) return [];
    var hits = [];
    pairs.forEach(function (row) {
      if (row.status && row.status !== 'published') return;
      if (!rowFilter(row)) return;
      var nq = normalizeUtterance(row.q);
      if (!isContainedMatch(u, nq, { flowOnlyExact: true })) return;
      hits.push(row);
    });
    return hits;
  }

  function matchMainFunctions(text, pairs) {
    var rows = matchRows(text, pairs, isFunctionRow);
    var byA = new Map();
    rows.forEach(function (row) {
      var id = row.aId || global.QaFeatureIds.nameToId(row.a) || row.a;
      if (!byA.has(row.a)) {
        byA.set(row.a, {
          name: row.a,
          id: id,
          group: '',
          note: row.note || ''
        });
      }
    });
    return Array.from(byA.values());
  }

  function matchKnowledge(text, pairs) {
    return matchRows(text, pairs, isKnowledgeRow).map(function (row) {
      return {
        q: row.q,
        text: row.a,
        note: row.note || ''
      };
    });
  }

  global.IntentMatchPc = {
    normalizeUtterance: normalizeUtterance,
    isContainedMatch: isContainedMatch,
    matchMainFunctions: matchMainFunctions,
    matchKnowledge: matchKnowledge,
    MIN_CONTAIN_LEN: MIN_CONTAIN_LEN
  };
})(typeof window !== 'undefined' ? window : globalThis);
