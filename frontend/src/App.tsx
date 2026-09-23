import { Routes, Route, Link } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { CaseWizard } from './pages/CaseWizard';
import { Report } from './pages/Report';

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/" className="font-serif text-sm font-semibold text-ink no-underline">
            Trade Compliance Copilot
          </Link>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/case/:id" element={<CaseWizard />} />
        <Route path="/case/:id/report" element={<Report />} />
      </Routes>
    </div>
  );
}
