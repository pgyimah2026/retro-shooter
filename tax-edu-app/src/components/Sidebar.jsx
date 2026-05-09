import { BookOpen, Calculator, Calendar, MessageCircle, Target, ClipboardList } from 'lucide-react'

const NAV_ITEMS = [
  { id: 'guides',     icon: BookOpen,       label: 'Tax Guides' },
  { id: 'calculator', icon: Calculator,     label: 'Tax Calculator' },
  { id: 'planning',   icon: Target,         label: 'Tax Planning' },
  { id: 'deadlines',  icon: Calendar,       label: 'Key Deadlines' },
  { id: 'checklist',  icon: ClipboardList,  label: 'Documents' },
  { id: 'chat',       icon: MessageCircle,  label: 'Ask AI' },
]

const TAX_YEAR = new Date().getFullYear()

export default function Sidebar({ mode, setMode, activePage, setActivePage, open }) {
  return (
    <aside
      className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-60 bg-white border-r border-gray-200 flex flex-col shrink-0
        transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: '#1D9E75' }}
          >
            <span className="text-white text-sm font-bold">$</span>
          </div>
          <div>
            <span className="text-gray-900 font-semibold text-sm">TPS Tax IQ</span>
            <p className="text-xs text-gray-400 leading-tight">{TAX_YEAR} Tax Year</p>
          </div>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="px-4 py-4 border-b border-gray-100">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Mode</p>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setMode('individual')}
            className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${
              mode === 'individual'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Individual
          </button>
          <button
            onClick={() => setMode('business')}
            className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${
              mode === 'business'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Business
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
          const active = activePage === id
          return (
            <button
              key={id}
              onClick={() => setActivePage(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left ${
                active
                  ? 'font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
              style={
                active
                  ? { backgroundColor: '#e8f7f2', color: '#1D9E75' }
                  : {}
              }
            >
              <Icon size={16} />
              {label}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 leading-relaxed">
          For educational purposes only. Not financial or legal advice.
        </p>
      </div>
    </aside>
  )
}
