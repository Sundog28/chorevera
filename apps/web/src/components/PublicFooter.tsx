import "../pages/LegalPage.css";

export default function PublicFooter() {
  return (
    <footer className="public-footer">
      <div>
        <strong>ChoreFlow</strong>
        <span>Shared household routines, made easier.</span>
      </div>

      <nav aria-label="Legal and support" className="public-footer-links">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/support">Support</a>
      </nav>
    </footer>
  );
}
