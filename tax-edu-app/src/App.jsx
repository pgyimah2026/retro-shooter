import { useState } from 'react'
import Sidebar from './components/Sidebar'
import TaxGuides from './components/TaxGuides'
import TaxCalculator from './components/TaxCalculator'
import TaxPlanning from './components/TaxPlanning'
import Deadlines from './components/Deadlines'
import AIChat from './components/AIChat'
import DocumentsChecklist from './components/DocumentsChecklist'
import './App.css'

const TAX_YEAR  = new Date().getFullYear()      // 2026 — current tax year
const PLAN_YEAR = new Date().getFullYear() + 1  // 2027 — forward planning

const PAGE_META = {
  guides: {
    title: 'Tax Guides',
    subtitle: 'Learn tax concepts with clear, plain-language explanations',
  },
  calculator: {
    title: 'Tax Calculator',
    subtitle: `Estimate your ${TAX_YEAR} federal income tax liability`,
  },
  planning: {
    title: 'Tax Planning',
    subtitle: `Plan ahead — project your ${PLAN_YEAR} tax situation and find savings opportunities`,
  },
  deadlines: {
    title: 'Key Deadlines',
    subtitle: 'Stay ahead of important tax filing dates',
  },
  checklist: {
    title: 'Documents Checklist',
    subtitle: 'Track every document you need to file your 2026 tax return',
  },
  chat: {
    title: 'Ask AI',
    subtitle: 'Get plain-language answers to your tax questions',
  },
}

export default function App() {
  const [mode, setMode] = useState('individual')
  const [activePage, setActivePage] = useState('guides')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { title, subtitle } = PAGE_META[activePage]

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        mode={mode}
        setMode={setMode}
        activePage={activePage}
        setActivePage={(page) => {
          setActivePage(page)
          setSidebarOpen(false)
        }}
        open={sidebarOpen}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
          <button
            className="lg:hidden p-1.5 rounded-md hover:bg-gray-100 text-gray-600"
            onClick={() => setSidebarOpen(true)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 leading-tight">{title}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activePage === 'guides'     && <TaxGuides mode={mode} />}
          {activePage === 'calculator' && <TaxCalculator mode={mode} />}
          {activePage === 'planning'   && <TaxPlanning />}
          {activePage === 'deadlines'  && <Deadlines mode={mode} />}
          {activePage === 'checklist'  && <DocumentsChecklist mode={mode} />}
          {activePage === 'chat'       && <AIChat mode={mode} />}
        </div>
      </div>
    </div>
  )
}
