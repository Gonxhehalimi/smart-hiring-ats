import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function Layout({ title, children }) {
  return (
    <div className="flex min-h-screen bg-[#f8fafc]">
      <div className="w-[240px] shrink-0">
        <Sidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} />
        <main className="flex-1 overflow-y-auto bg-[#f8fafc]">{children}</main>
      </div>
    </div>
  )
}
