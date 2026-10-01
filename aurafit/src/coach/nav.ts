import { useUI, type Tab } from '../store/ui'

export function closeAllSheetsAnd(tab: Tab) {
  useUI.getState().closeAllSheets()
  useUI.getState().setTab(tab)
}
