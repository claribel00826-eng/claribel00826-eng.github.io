/** 目标主功能 A 枚举（L0）· 与 v1.5.0/scripts/build-intent-qa.py 一致；不含子卡片 */
(function (global) {
  var FEATURE_IDS = {
    '今日待跟': 'followup',
    '新增客户': 'customer-create',
    '方案速配': 'plan',
    '产品报价': 'quote',
    '交期评审': 'delivery',
    '确认下单': 'order',
    '复制订单': 'copy',
    '订单变更': 'change',
    '订单进度': 'progress',
    '产能分析': 'capacity',
    '库存查询': 'inventory',
    '业务分析': 'biz-analysis',
    '回款分析': 'payment',
    '切换客户': 'switch-customer'
  };

  var FEATURE_NAMES = Object.keys(FEATURE_IDS);

  var TAG_COLORS = {
    '今日待跟': { bg: '#E0F2F1', fg: '#0D5C59' },
    '新增客户': { bg: '#F5F5F5', fg: '#52525B' },
    '切换客户': { bg: '#F5F5F5', fg: '#52525B' },
    '方案速配': { bg: '#E3F2FD', fg: '#1565C0' },
    '产品报价': { bg: '#E3F2FD', fg: '#1565C0' },
    '确认下单': { bg: '#E3F2FD', fg: '#1565C0' },
    '交期评审': { bg: '#FFF3E0', fg: '#E65100' },
    '复制订单': { bg: '#FFF3E0', fg: '#E65100' },
    '订单变更': { bg: '#FFF3E0', fg: '#E65100' },
    '订单进度': { bg: '#FFF3E0', fg: '#E65100' },
    '产能分析': { bg: '#F3E5F5', fg: '#7B1FA2' },
    '库存查询': { bg: '#F3E5F5', fg: '#7B1FA2' },
    '业务分析': { bg: '#F3E5F5', fg: '#7B1FA2' },
    '回款分析': { bg: '#F3E5F5', fg: '#7B1FA2' }
  };

  function nameToId(name) {
    return FEATURE_IDS[name] || '';
  }

  function isValidName(name) {
    return Object.prototype.hasOwnProperty.call(FEATURE_IDS, name);
  }

  global.QaFeatureIds = {
    FEATURE_IDS: FEATURE_IDS,
    FEATURE_NAMES: FEATURE_NAMES,
    TAG_COLORS: TAG_COLORS,
    nameToId: nameToId,
    isValidName: isValidName
  };
})(typeof window !== 'undefined' ? window : globalThis);
