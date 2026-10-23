import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Logo from "@/components/ui/logo";
import { useScrollPosition } from "@/hooks/use-scroll-position";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/execom", label: "Execom" },
  { href: "/activities", label: "Activities" },
  { href: "/achievements", label: "Achievements" },
  { href: "/contact", label: "Contact" },
];

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location] = useLocation();
  const scrollPosition = useScrollPosition();

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const isScrolled = scrollPosition > 100;

  return (
    <>
      {/* Skip to content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 bg-primary text-primary-foreground px-4 py-2 rounded-md focus-cosmic"
        data-testid="skip-to-content"
      >
        Skip to main content
      </a>

  <nav
    className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-background/80 backdrop-blur-md accent-border-bottom ${
          isScrolled ? "shadow-sm" : ""
        }`}
        data-testid="main-navigation"
      >
  <div className="container mx-auto px-3 py-2 md:px-4 md:py-3">
          <div className="flex items-center justify-between">
            {/* Logo and Brand */}
            <Link href="/" className="flex items-center group" data-testid="logo-link">
              <Logo
                size="sm"
                withText
                showSeparator={true}
                showSubline={true}
                headlineClassName="text-sm md:text-base"
                sublineClassName="text-[10px] md:text-xs"
                className="transition-transform duration-200 group-hover:scale-[1.02]"
              />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6 md:space-x-8">
        {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
          className={`font-medium text-sm md:text-base transition-colors duration-300 focus-cosmic ink-link ${
                    location === item.href
                      ? "text-primary"
                      : "text-muted-foreground hover:text-primary"
                  }`}
                  aria-current={location === item.href ? "page" : undefined}
                  data-testid={`nav-link-${item.label.toLowerCase()}`}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden border rounded-lg focus-cosmic active:scale-95"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle mobile menu"
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-menu"
              data-testid="mobile-menu-toggle"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>

          {/* Mobile Navigation */}
          {isMobileMenuOpen && (
            <div
              id="mobile-menu"
              role="menu"
              aria-label="Main navigation"
              className="md:hidden mt-3 space-y-1.5 rounded-xl p-2 border bg-background shadow-sm"
              data-testid="mobile-menu"
              onKeyDown={(e) => {
                if (e.key === "Escape") setIsMobileMenuOpen(false);
              }}
            >
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block font-medium py-2.5 px-2 rounded-lg transition-colors duration-300 focus-cosmic ${
                    location === item.href
                      ? "text-primary"
                      : "text-muted-foreground hover:text-primary"
                  }`}
                  data-testid={`mobile-nav-link-${item.label.toLowerCase()}`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
