import { defineStore } from 'pinia'

import {
  mockCustomers,
  mockDeliveryIssues,
  mockFollowUpRecords,
  mockOrders,
  mockProducts,
  mockProposal,
  mockProposals,
  mockQuote,
  mockQuotes,
  mockServiceResult,
  mockUser,
} from '@/data/mock'
import type {
  CartItem,
  Customer,
  DeliveryReviewFlowStatus,
  FollowUpEntry,
  FollowUpRecord,
  Proposal,
  ProposalLine,
  Quote,
  SaveQuotePayload,
  ServiceResult,
} from '@/types/business'
import type { IntentRecognitionResult } from '@/types/intent'

export const useAppStore = defineStore('app', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    user: mockUser,
    customers: mockCustomers,
    products: mockProducts,
    orders: mockOrders,
    deliveryIssues: mockDeliveryIssues,
    currentCustomerId: mockCustomers[0]?.id || '',
    cart: [
      {
        id: 'cart-001',
        productId: 'p-001',
        name: '高强度内六角螺栓',
        spec: 'M6 x 30 / 12.9 级',
        quantity: 10,
        unit: '盒',
        price: 128,
      },
      {
        id: 'cart-002',
        productId: 'p-002',
        name: '防松垫圈套装',
        spec: 'M6-M10 混合装',
        quantity: 10,
        unit: '套',
        price: 86,
      },
    ] as CartItem[],
    proposal: mockProposal as Proposal,
    /** 按客户可查的历史方案（保存后写入队首）；上线后对齐后端分页 */
    proposals: [...mockProposals] as Proposal[],
    /** 非空时表示正基于某历史方案在购物车中改版，保存时将生成新版本并写入 revisedFrom */
    revisingFromProposalId: null as string | null,
    /** 「方案」步骤默认勾选的购物车行 id；null 表示未指定则默认勾选全部购物车行 */
    pendingProposalLineIds: null as string[] | null,
    quote: mockQuote as Quote,
    /** 报价单列表（交期评审选择上下文）；保存报价时递增 */
    quotes: [...mockQuotes] as Quote[],
    /** 当前报价下交期评审：未完成 / 已在报价环节确认跳过 / 已完成评审 */
    deliveryReviewStatus: 'none' as DeliveryReviewFlowStatus,
    serviceResult: mockServiceResult as ServiceResult,
    /** 客户跟进记录（多客户、按时间倒序由各页自行筛选） */
    followUpRecords: [...mockFollowUpRecords] as FollowUpRecord[],
    voiceMode: true,
    /** 全局底部输入：最近一次转写文本 */
    lastUtterance: '',
    intentLoading: false,
    lastIntent: null as IntentRecognitionResult | null,
    /** 供各页消费：将底部栏内容填入当前页表单 */
    voiceFillTick: 0,
    voiceFillTargetRoute: '' as string,
    voiceFillText: '',
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.token),
    currentCustomer: (state): Customer =>
      state.customers.find((item) => item.id === state.currentCustomerId) || state.customers[0],
    cartTotal: (state) =>
      state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    followCustomers: (state) =>
      state.customers.filter((item) => item.type === 'old-timeout' || item.type === 'public-new'),
    proposalsCurrentCustomer: (state): Proposal[] => {
      return state.proposals
        .filter((p) => p.customerId === state.currentCustomerId)
        .slice()
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    },
    /** 当前客户下的报价单（按保存时间倒序）；通过方案关联过滤客户 */
    quotesCurrentCustomer: (state): Quote[] => {
      return state.quotes
        .filter((q) => {
          const p = state.proposals.find((pr) => pr.id === q.proposalId)
          return p?.customerId === state.currentCustomerId
        })
        .slice()
        .sort((a, b) => {
          const ta = a.createdAt || ''
          const tb = b.createdAt || ''
          return ta < tb ? 1 : -1
        })
    },
    /** 当前客户在写跟进页使用：时间新 → 旧 */
    followUpsCurrentCustomer: (state): FollowUpRecord[] => {
      return state.followUpRecords
        .filter((f) => f.customerId === state.currentCustomerId)
        .slice()
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    },
    /** 指定客户的跟进时间线（新→旧） */
    followUpsForCustomer:
      (state) =>
      (customerId: string): FollowUpRecord[] => {
        return state.followUpRecords
          .filter((f) => f.customerId === customerId)
          .slice()
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      },
  },
  actions: {
    login() {
      this.token = 'mock-token'
      localStorage.setItem('token', this.token)
    },
    logout() {
      this.token = ''
      localStorage.removeItem('token')
    },
    setCustomer(customerId: string) {
      this.currentCustomerId = customerId
    },
    addFollowUp(entry: FollowUpEntry) {
      const text = entry.content.trim()
      if (!text) return
      const row: FollowUpRecord = {
        id: `fu-${Date.now()}`,
        customerId: this.currentCustomer.id,
        contactPerson: entry.contactPerson.trim(),
        contactMethod: entry.contactMethod.trim(),
        shipAddress: entry.shipAddress.trim(),
        content: text,
        reminderDate: entry.reminderDate.trim(),
        followStatus: entry.followStatus.trim() || '跟进中',
        createdAt: new Date().toISOString(),
        operatorName: this.user.name,
      }
      this.followUpRecords = [row, ...this.followUpRecords]
    },
    addToCart(productId: string) {
      const product = this.products.find((item) => item.id === productId)
      if (!product) return
      const existed = this.cart.find((item) => item.productId === productId)
      if (existed) {
        existed.quantity += 1
        return
      }
      this.cart.push({
        id: `cart-${Date.now()}`,
        productId: product.id,
        name: product.name,
        spec: product.spec,
        quantity: 1,
        unit: product.unit,
        price: product.price,
      })
    },
    updateCartQuantity(itemId: string, quantity: number) {
      const item = this.cart.find((row) => row.id === itemId)
      if (item) item.quantity = Math.max(1, quantity)
    },
    removeCartItem(itemId: string) {
      this.cart = this.cart.filter((item) => item.id !== itemId)
    },
    upsertCartLine(productId: string, spec: string, quantity: number) {
      const product = this.products.find((item) => item.id === productId)
      if (!product) return
      const qty = Math.max(1, Math.floor(Number(quantity) || 1))
      const lineSpec = spec.trim() || product.spec
      const idx = this.cart.findIndex((item) => item.productId === productId)
      const row: CartItem = {
        id:
          idx !== -1 ? this.cart[idx].id : `cart-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
        productId,
        name: product.name,
        spec: lineSpec,
        quantity: qty,
        unit: product.unit,
        price: product.price,
      }
      if (idx !== -1) this.cart.splice(idx, 1, row)
      else this.cart.push(row)
    },
    clearCart() {
      this.cart = []
    },
    saveProposal(payload: Pick<Proposal, 'name' | 'remark'>, lineCartIds?: string[]) {
      const allIds = this.cart.map((c) => c.id)
      let ids =
        lineCartIds && lineCartIds.length > 0
          ? lineCartIds
          : this.pendingProposalLineIds && this.pendingProposalLineIds.length > 0
            ? this.pendingProposalLineIds
            : allIds

      ids = [...new Set(ids)].filter((id) => allIds.includes(id))
      const selected = this.cart.filter((c) => ids.includes(c.id))

      const lines: ProposalLine[] = selected.map((row) => ({
        productId: row.productId,
        name: row.name,
        spec: row.spec,
        quantity: row.quantity,
        unit: row.unit,
        price: row.price,
      }))
      const total = lines.reduce((sum, row) => sum + row.price * row.quantity, 0)

      const id = `s-${Date.now()}`
      const next: Proposal = {
        id,
        customerId: this.currentCustomer.id,
        name: payload.name,
        remark: payload.remark,
        itemCount: lines.length,
        totalAmount: total,
        createdAt: new Date().toISOString(),
        lines,
        revisedFrom: this.revisingFromProposalId || undefined,
      }
      this.revisingFromProposalId = null
      this.proposals = [next, ...this.proposals]
      this.proposal = next
      this.pendingProposalLineIds = null

      const idSet = new Set(ids)
      this.cart = this.cart.filter((c) => !idSet.has(c.id))
    },
    /** 将商品加入购物车后，标记仅这些行用于下一屏方案勾选（可多轮加购后再进方案页） */
    setPendingProposalFromProductIds(productIds: string[]) {
      const uniq = [...new Set(productIds)]
      if (uniq.length === 0) {
        this.pendingProposalLineIds = null
        return
      }
      for (const pid of uniq) {
        const existed = this.cart.find((c) => c.productId === pid)
        if (!existed) this.addToCart(pid)
      }
      this.pendingProposalLineIds = this.cart
        .filter((c) => uniq.includes(c.productId))
        .map((c) => c.id)
    },
    /** 从购物车勾选子集进入方案时使用 */
    setPendingProposalCartLineIds(lineIds: string[] | null) {
      if (!lineIds || lineIds.length === 0) {
        this.pendingProposalLineIds = null
        return
      }
      const uniq = [...new Set(lineIds)].filter((id) => this.cart.some((c) => c.id === id))
      this.pendingProposalLineIds = uniq.length > 0 ? uniq : null
    },
    startProposalRevision(proposalId: string) {
      const proposal = this.proposals.find((p) => p.id === proposalId)
      if (!proposal) return
      this.setCustomer(proposal.customerId)
      this.cart = proposal.lines.map((line, idx) => ({
        id: `cart-${Date.now()}-${idx}`,
        productId: line.productId,
        name: line.name,
        spec: line.spec,
        quantity: line.quantity,
        unit: line.unit,
        price: line.price,
      }))
      this.revisingFromProposalId = proposalId
      this.pendingProposalLineIds = this.cart.map((c) => c.id)
    },
    /** 从历史或 PDF 页进入报价前，将当前上下文方案切换为所选 id */
    setActiveProposal(proposalId: string) {
      const p = this.proposals.find((item) => item.id === proposalId)
      if (p) this.proposal = p
    },
    saveQuote(payload: SaveQuotePayload) {
      const d = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const valid = new Date(d.getTime() + 7 * 86400000)
      const quoteNo = `BJ${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`
      const row: Quote = {
        id: `q-${Date.now()}`,
        proposalId: this.proposal.id,
        quoteNo,
        totalAmount: payload.totalAmount,
        validUntil: `${valid.getFullYear()}-${pad(valid.getMonth() + 1)}-${pad(valid.getDate())}`,
        createdAt: d.toISOString(),
        inquirySubtotal: payload.inquirySubtotal,
        lines: payload.lines,
      }
      this.quotes = [row, ...this.quotes]
      this.quote = row
      this.deliveryReviewStatus = 'none'
    },
    /** 从报价 PDF 回到询价后，覆盖保存同一条报价单（Mock） */
    updateQuote(quoteId: string, payload: SaveQuotePayload) {
      const idx = this.quotes.findIndex((q) => q.id === quoteId)
      if (idx < 0) return
      const prev = this.quotes[idx]
      const d = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const valid = new Date(d.getTime() + 7 * 86400000)
      const next: Quote = {
        ...prev,
        proposalId: this.proposal.id,
        totalAmount: payload.totalAmount,
        inquirySubtotal: payload.inquirySubtotal,
        lines: payload.lines,
        validUntil: `${valid.getFullYear()}-${pad(valid.getMonth() + 1)}-${pad(valid.getDate())}`,
        createdAt: d.toISOString(),
      }
      const copy = [...this.quotes]
      copy[idx] = next
      this.quotes = copy
      this.quote = next
      this.deliveryReviewStatus = 'none'
    },
    setActiveQuote(quoteId: string) {
      const row = this.quotes.find((q) => q.id === quoteId)
      if (!row) return
      this.quote = row
      const p = this.proposals.find((pr) => pr.id === row.proposalId)
      if (p) this.proposal = p
    },
    /** 从交期评审页进入下单前调用 */
    completeDeliveryReview() {
      this.deliveryReviewStatus = 'completed'
    },
    /** 报价页「跳过交期」弹窗确认后调用 */
    confirmSkipDeliveryReview() {
      this.deliveryReviewStatus = 'skipped_confirmed'
    },
    toggleVoiceMode() {
      this.voiceMode = !this.voiceMode
    },
    setLastIntent(result: IntentRecognitionResult | null) {
      this.lastIntent = result
    },
    clearLastIntent() {
      this.lastIntent = null
    },
    publishVoiceFill(routeName: string, text: string) {
      this.voiceFillTargetRoute = routeName
      this.voiceFillText = text
      this.voiceFillTick += 1
    },
  },
})
