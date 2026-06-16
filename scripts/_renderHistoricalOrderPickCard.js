  function renderHistoricalOrderPickCard(c, list, opts) {
    opts = opts || {};
    const mode = opts.mode || 'copy';
    const state =
      mode === 'copy'
        ? ensureCopyPickState()
        : mode === 'progress'
          ? ensureProgressPickState()
          : ensureOrderListPickState('change');
    const action =
      mode === 'change'
        ? 'change-pick'
        : mode === 'progress'
          ? 'progress-pick'
          : 'copy-pick';
    const head =
      opts.headTitle ||
      (mode === 'change'
        ? '订单变更 · 选择历史单'
        : mode === 'progress'
          ? '订单进度 · 选择订单'
          : '复制订单 · 选择历史单');
    const visible = list.slice(0, state.visibleCount);
    const hasMore = list.length > visible.length;
    const totalPool = ordersForCustomer(c.id).length;
    const stats =
      list.length !== totalPool
        ? '匹配 <strong>' + list.length + '</strong> 笔（共 ' + totalPool + ' 笔）'
        : '共 <strong>' + list.length + '</strong> 笔历史订单';
    const demandHint =
      (mode === 'copy' || mode === 'progress') && state.demandText
        ? '<p class="sc-card__meta">需求：' +
          App.escapeHtml(state.demandText) +
          ' <button type="button" class="sc-link-btn" data-action="' +
          (mode === 'progress' ? 'progress-edit-demand' : 'copy-edit-demand') +
          '">修改</button></p>'
        : '';
    const rows = visible
      .map(function (o, i) {
        const n = i + 1;
        return (
          '<button type="button" class="sc-follow-row sc-follow-row--select" data-action="' +
          action +
          '" data-oid="' +
          App.escapeHtml(o.id) +
          '" data-pick-index="' +
          n +
          '"><span class="sc-follow-row__stack">' +
          '<span class="sc-follow-row__name">' +
          n +
          '. ' +
          App.escapeHtml(o.no) +
          '</span><span class="sc-follow-row__meta">' +
          App.escapeHtml(o.date || '—') +
          ' · ' +
          App.escapeHtml(o.amount || '—') +
          '</span><span class="sc-follow-row__meta">' +
          App.escapeHtml(o.items || '—') +
          '</span></span></button>'
        );
      })
      .join('');
    const emptyHint =
      list.length === 0
        ? '<p class="sc-card__meta">无匹配订单，请调整检索或修改需求。</p>'
        : '';
    const loadMoreAction =
      mode === 'progress' ? 'progress-order-load-more' : 'copy-order-load-more';
    const moreBtn = hasMore
      ? '<button type="button" class="sc-btn sc-btn--ghost" data-action="' +
        loadMoreAction +
        '">加载更多（已显示 ' +
        visible.length +
        ' / ' +
        list.length +
        '）</button>'
      : '';
    const dataAttr =
      mode === 'copy'
        ? ' data-copy-pick="1"'
        : mode === 'progress'
          ? ' data-progress-pick="1"'
          : ' data-change-pick="1"';
    return (
      '<div class="sc-card sc-card--compact sc-card--historical-order-pick" data-spec-id="card-order-pick"' +
      dataAttr +
      '><div class="sc-card__head sc-card__head--compact">' +
      head +
      '</div><p class="sc-card__meta">' +
      stats +
      '</p>' +
      demandHint +
      renderCopyOrderQueryRow(state.filter) +
      '<div class="sc-follow-list sc-copy-order-pick-list">' +
      rows +
      emptyHint +
      '</div>' +
      (moreBtn ? '<div class="sc-card__actions-inline">' + moreBtn + '</div>' : '') +
      '</div>'
    );
  }
