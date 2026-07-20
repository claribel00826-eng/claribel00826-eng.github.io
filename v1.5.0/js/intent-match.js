/**
 * L0 主功能召回 · 方案 C（多 Q 命中取 A 并集）
 * 数据源：intent-qa.generated.js（由 Excel 构建）
 */
(function () {
  const MIN_CONTAIN_LEN = 2;

  /** 流程内操作话术特征：命中时仅允许与 Q 完全一致，不做包含匹配 */
  const FLOW_UTTERANCE_RE =
    /下一步|逐项|勾选|筛选|加购|模板|保存这个|确认需求|生成方案|保存方案|数量|规格|填价|第\d|第[一二三四五六七八九十]|报价\s*\d|单价\d/;

  /** 复合/多意图 Q：短用户句不得通过「被包含」误命中 */
  const COMPOSITE_Q_RE = /[并,，、]|切换|然后|再/;

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
    const pt = row.pairType;
    return !pt || pt === 'function' || pt === '功能';
  }

  function isKnowledgeRow(row) {
    return row && (row.pairType === 'knowledge' || row.pairType === '知识');
  }

  function matchRows(text, data, rowFilter) {
    if (!data || !data.pairs || !data.pairs.length) return [];
    const u = normalizeUtterance(text);
    if (!u) return [];
    const hits = [];
    data.pairs.forEach(function (row) {
      if (!rowFilter(row)) return;
      const nq = normalizeUtterance(row.q);
      if (!isContainedMatch(u, nq, { flowOnlyExact: true })) return;
      hits.push(row);
    });
    return hits;
  }

  /**
   * 匹配主功能（仅入口层；流程内话术由 tryIntent 处理）
   * @param {string} text
   * @param {{ pairs?: Array<{q:string,a:string,aId?:string,pairType?:string}> }} [opts]
   * @returns {Array<{name:string,id:string,group?:string,note?:string}>}
   */
  function matchMainFunctions(text, opts) {
    opts = opts || {};
    const data = opts.pairs ? { pairs: opts.pairs } : window.IntentQa;
    const rows = matchRows(text, data, isFunctionRow);
    const byA = new Map();
    rows.forEach(function (row) {
      const id = row.aId || row.a;
      if (!byA.has(row.a)) {
        byA.set(row.a, {
          name: row.a,
          id: id,
          group: row.group || '',
          note: row.note || ''
        });
      }
    });
    return Array.from(byA.values());
  }

  /**
   * 知识/固定话术命中（与功能相同包含规则）
   * @param {string} text
   * @returns {Array<{q:string,text:string,note:string}>}
   */
  function matchKnowledge(text) {
    const data = window.IntentQa;
    return matchRows(text, data, isKnowledgeRow).map(function (row) {
      return {
        q: row.q,
        text: row.a,
        note: row.note || ''
      };
    });
  }

  /**
   * 仅返回 skillId 列表（去重保序）
   * @param {string} text
   * @returns {string[]}
   */
  function matchMainFunctionIds(text) {
    return matchMainFunctions(text).map(function (x) {
      return x.id;
    });
  }

  window.IntentMatch = {
    normalizeUtterance: normalizeUtterance,
    isContainedMatch: isContainedMatch,
    matchMainFunctions: matchMainFunctions,
    matchKnowledge: matchKnowledge,
    matchMainFunctionIds: matchMainFunctionIds,
    MIN_CONTAIN_LEN: MIN_CONTAIN_LEN
  };
})();
