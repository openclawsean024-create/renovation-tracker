// FR-011 in-app 「使用說明」 entry — GOAL AC-006. A condensed version of
// docs/USER-GUIDE.md shown in a modal so the guide is reachable offline from
// inside the app (the full text lives in the repo's docs/USER-GUIDE.md).

import { useId } from 'react'
import { Modal } from './Modal'

export interface HelpDialogProps {
  open: boolean
  onClose: () => void
}

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  const titleId = useId()
  return (
    <Modal open={open} title="使用說明" onClose={onClose} labelledById={titleId} wide>
      <div className="help-content" data-testid="help-dialog">
        <h3>業者端（設計公司／統包商）</h3>
        <ol>
          <li>在「階段與工期」新增或調整階段，更新狀態後完成度會自動計算。</li>
          <li>在「照片紀錄」上傳現場照片並關聯階段；「照片進度回報」會依階段彙整最新一張。</li>
          <li>在「預算追蹤」記錄成本預算與實際支出（業者自己的成本）。</li>
          <li>在「合約與收款」填合約金額與已收金額；有追加減時到「預算變更單」新增，並記錄核准或拒絕。</li>
          <li>在「階段驗收」為每個階段列驗收項目，逐項勾選通過。</li>
          <li>在「師傅排程」與「保固紀錄」維護工班時間與保固期限。</li>
          <li>點「產生唯讀分享連結」把當下快照傳給屋主。</li>
        </ol>
        <h3>屋主端</h3>
        <ol>
          <li>開啟業者傳來的連結即可查看，不需要登入或安裝。</li>
          <li>頁面是產生連結當下的快照，不會自動更新；要看最新進度請業者重新產生連結。</li>
          <li>可以看到階段進度、照片數量與最新拍攝日、合約收款概要、變更單狀態、驗收進度與保固。</li>
        </ol>
        <h3>請注意</h3>
        <ul>
          <li>資料只存在這台裝置的瀏覽器（IndexedDB）。清除瀏覽器資料、換瀏覽器或換裝置，紀錄都會遺失。</li>
          <li>變更單的「核准／拒絕」是本機紀錄，非屋主線上簽核，也不是電子簽章。</li>
          <li>分享連結未加密、無法撤銷；工程地址與聯絡方式預設不會放入，需要時再勾選。</li>
          <li>分享連結不含照片原圖；照片原圖僅存於業者裝置。</li>
        </ul>
        <p className="field-hint">完整說明請見專案內的 docs/USER-GUIDE.md。</p>
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn primary" onClick={onClose} data-testid="help-close">
          關閉
        </button>
      </div>
    </Modal>
  )
}
