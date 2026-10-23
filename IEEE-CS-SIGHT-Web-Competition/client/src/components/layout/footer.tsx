import { Link } from "wouter";
import Logo from "@/components/ui/logo";
import { Mail, Phone, MapPin, Github, Linkedin, Twitter } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-16 sm:mt-20 py-10 sm:py-12 px-4 border-t bg-background no-print" data-testid="main-footer">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="md:col-span-2">
            <div className="flex items-center mb-4 group">
              <Logo size="sm" withText sublineClassName="hidden md:block" />
            </div>
            <p className="text-muted-foreground mb-4 max-w-md">
              Empowering communities through technology. IEEE SIGHT at CEK is dedicated to creating sustainable solutions for a better tomorrow.
            </p>
            <div className="flex items-center gap-4">
              <img
                src="/ieee-logo-black.png"
                alt="IEEE logo"
                className="h-8 w-auto opacity-90"
                loading="lazy"
                decoding="async"
              />
            </div>

      <div className="flex space-x-4 mt-4">
              <a
                href="#"
        className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted/40 transition-colors focus-cosmic"
                aria-label="Twitter"
                data-testid="social-twitter"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="#"
        className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted/40 transition-colors focus-cosmic"
                aria-label="LinkedIn"
                data-testid="social-linkedin"
              >
                <Linkedin className="w-5 h-5" />
              </a>
              <a
                href="#"
        className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted/40 transition-colors focus-cosmic"
                aria-label="GitHub"
                data-testid="social-github"
              >
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-poppins font-semibold mb-3">Quick Links</h4>
            <ul className="space-y-1.5">
              <li>
                <Link href="/" className="text-muted-foreground hover:text-primary transition-colors focus-cosmic ink-link">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-muted-foreground hover:text-primary transition-colors focus-cosmic ink-link">
                  About
                </Link>
              </li>
              <li>
                <Link href="/execom" className="text-muted-foreground hover:text-primary transition-colors focus-cosmic ink-link">
                  Team
                </Link>
              </li>
              <li>
                <Link href="/activities" className="text-muted-foreground hover:text-primary transition-colors focus-cosmic ink-link">
                  Activities
                </Link>
              </li>
              <li>
                <Link href="/achievements" className="text-muted-foreground hover:text-primary transition-colors focus-cosmic ink-link">
                  Achievements
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
      <h4 className="text-lg font-poppins font-semibold mb-3">Contact</h4>
            <ul className="space-y-3">
              <li className="flex items-center space-x-3">
                <Mail className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">sight@ieee.sbcek.org</span>
              </li>
              <li className="flex items-center space-x-3">
                <Phone className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">+91 9876543210</span>
              </li>
              <li className="flex items-center space-x-3">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">3H74+RQQ, Engineering College Rd, Thodiyoor, Karunagappalli, Kerala 690523</span>
              </li>
            </ul>
          </div>
        </div>

    <div className="border-t border-border mt-8 pt-6 sm:pt-8 text-center">
          <p className="text-muted-foreground">
            © 2024 IEEE SIGHT - College of Engineering Karunagappally. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
