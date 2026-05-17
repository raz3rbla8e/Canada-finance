"""Tests for mobile / responsive support — Boreal SPA design."""
import re


class TestMobileViewport:
    """Verify the HTML has the correct viewport meta tag for mobile."""

    def test_viewport_meta_present(self, client):
        res = client.get("/")
        html = res.data.decode()
        assert 'name="viewport"' in html
        assert "width=device-width" in html
        assert "initial-scale=1" in html

    def test_no_user_scalable_no(self, client):
        """Users should be able to zoom on mobile (no user-scalable=no)."""
        res = client.get("/")
        html = res.data.decode()
        assert "user-scalable=no" not in html


class TestResponsiveCSS:
    """Verify the CSS contains responsive breakpoints for the Boreal design."""

    def test_css_loads(self, client):
        res = client.get("/static/css/style.css")
        assert res.status_code == 200

    def test_1100_breakpoint_exists(self, client):
        css = client.get("/static/css/style.css").data.decode()
        assert "max-width:1100px" in css or "max-width: 1100px" in css

    def test_720_breakpoint_exists(self, client):
        css = client.get("/static/css/style.css").data.decode()
        assert "max-width:720px" in css or "max-width: 720px" in css

    def test_sidebar_collapses_at_1100(self, client):
        """At <=1100px sidebar should shrink to icon-only (64px)."""
        css = client.get("/static/css/style.css").data.decode()
        assert "grid-template-columns:64px" in css or "grid-template-columns: 64px" in css

    def test_nav_labels_hidden_at_1100(self, client):
        """Nav item text labels should hide at 1100px breakpoint."""
        css = client.get("/static/css/style.css").data.decode()
        assert re.search(r"\.nav-item>span.*display:\s*none", css)

    def test_grid2_single_column_at_1100(self, client):
        """grid-2 should become single column at smaller screens."""
        css = client.get("/static/css/style.css").data.decode()
        assert re.search(r"\.grid-2\s*\{[^}]*grid-template-columns:\s*1fr", css)

    def test_kpi_grid_adapts_at_1100(self, client):
        """KPI grid should go to 2 columns at 1100px."""
        css = client.get("/static/css/style.css").data.decode()
        assert re.search(r"\.kpi-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2", css)

    def test_kpi_grid_single_column_at_720(self, client):
        """KPI grid should go to 1 column at 720px."""
        css = client.get("/static/css/style.css").data.decode()
        m720 = re.search(r"@media\s*\(\s*max-width\s*:\s*720px\s*\)\s*\{(.+)", css, re.DOTALL)
        assert m720
        block = m720.group(1)
        assert "grid-template-columns:1fr" in block or "grid-template-columns: 1fr" in block

    def test_drawer_full_width_at_1100(self, client):
        """Drawer should be full width on smaller screens."""
        css = client.get("/static/css/style.css").data.decode()
        assert re.search(r"\.drawer\s*\{[^}]*width:\s*100%", css)

    def test_searchbox_hidden_at_720(self, client):
        """Searchbox should be hidden at 720px breakpoint."""
        css = client.get("/static/css/style.css").data.decode()
        m720 = re.search(r"@media\s*\(\s*max-width\s*:\s*720px\s*\)\s*\{(.+)", css, re.DOTALL)
        assert m720
        block = m720.group(1)
        assert "searchbox" in block
        assert "display:none" in block


class TestBorealSPAStructure:
    """Verify the SPA shell has proper structure for responsive behavior."""

    def test_app_shell_class(self, client):
        html = client.get("/").data.decode()
        assert 'class="app"' in html

    def test_sidebar_exists(self, client):
        html = client.get("/").data.decode()
        assert 'class="sidebar"' in html

    def test_main_content_area(self, client):
        html = client.get("/").data.decode()
        assert 'class="main-content"' in html or 'id="view-container"' in html

    def test_topbar_exists(self, client):
        html = client.get("/").data.decode()
        assert 'class="topbar"' in html

    def test_aside_landmark(self, client):
        """Sidebar should use aside element for accessibility."""
        html = client.get("/").data.decode()
        assert "<aside" in html

    def test_main_landmark(self, client):
        """Main content should use main element."""
        html = client.get("/").data.decode()
        assert "<main" in html


class TestBorealJS:
    """Verify the SPA JavaScript loads and has core navigation functions."""

    def test_js_loads(self, client):
        res = client.get("/static/js/app.js")
        assert res.status_code == 200

    def test_navigate_function_exists(self, client):
        js = client.get("/static/js/app.js").data.decode()
        assert "function navigateTo" in js or "navigateTo" in js

    def test_render_view_function_exists(self, client):
        js = client.get("/static/js/app.js").data.decode()
        assert "function renderView" in js

    def test_theme_toggle_exists(self, client):
        js = client.get("/static/js/app.js").data.decode()
        assert "applyTheme" in js
