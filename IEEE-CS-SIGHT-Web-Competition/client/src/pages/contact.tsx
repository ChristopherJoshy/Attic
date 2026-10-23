import { SectionHeading } from "@/components/ui/section-heading";
import { ContactFormComponent } from "@/components/ui/contact-form";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, MapPin, Github, Linkedin, Twitter } from "lucide-react";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import MapEmbed from "@/components/ui/map-embed";

const contactDetails = [
  {
    icon: Mail,
    label: "Email",
    value: "sight@ieee.sbcek.org",
    href: "mailto:sight@ieee.sbcek.org",
  },
  {
    icon: Phone,
    label: "Phone",
    value: "+91 9876543210",
    href: "tel:+919876543210",
  },
  {
    icon: MapPin,
    label: "Location",
  value: "3H74+RQQ, Engineering College Rd, Thodiyoor, Karunagappalli, Kerala 690523",
  href: "https://maps.google.com/?q=3H74%2BRQQ%2C%20Engineering%20College%20Rd%2C%20Thodiyoor%2C%20Karunagappalli%2C%20Kerala%20690523",
  },
];

const socialLinks = [
  { icon: Twitter, label: "Twitter", href: "#", color: "text-blue-400" },
  { icon: Linkedin, label: "LinkedIn", href: "#", color: "text-blue-600" },
  { icon: Github, label: "GitHub", href: "#", color: "text-gray-400" },
];

export default function Contact() {
  const { ref: contentRef, isIntersecting: contentVisible } = useIntersectionObserver();

  return (
    <div className="py-20 px-4 pt-32" data-testid="contact-page">
      <div className="container mx-auto">
        <SectionHeading
          title="Get In Touch"
          subtitle="Ready to join our mission? Connect with us and be part of the change"
        />

        <div 
          ref={contentRef}
          className={`grid lg:grid-cols-2 gap-12 transition-all duration-1000 ${
            contentVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
          data-testid="contact-content"
        >
          {/* Contact Information */}
          <div className="space-y-8">
            <Card className="glass-morphism card-cosmic">
              <CardContent className="p-8">
                <h3 className="text-2xl font-poppins font-semibold mb-6 text-primary">Contact Details</h3>
                
                <div className="space-y-6">
                  {contactDetails.map((detail, index) => (
                    <div 
                      key={index} 
                      className="flex items-center space-x-4"
                      data-testid={`contact-detail-${index}`}
                    >
                      <div className="w-12 h-12 cosmic-gradient rounded-full flex items-center justify-center">
                        <detail.icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{detail.label}</p>
                        <p className="text-muted-foreground whitespace-pre-line">{detail.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Social Media Links */}
            <Card className="glass-morphism card-cosmic">
              <CardContent className="p-8">
                <h3 className="text-2xl font-poppins font-semibold mb-6 text-primary">Follow Us</h3>
                <div className="flex space-x-4">
                  {socialLinks.map((social, index) => (
                    <a
                      key={index}
                      href={social.href}
                      className="w-12 h-12 cosmic-gradient rounded-full flex items-center justify-center hover:scale-110 transition-transform duration-300"
                      aria-label={social.label}
                      data-testid={`social-${social.label.toLowerCase()}`}
                    >
                      <social.icon className="w-6 h-6 text-white" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Map */}
            <Card className="glass-morphism card-cosmic">
              <CardContent className="p-8">
                <h3 className="text-2xl font-poppins font-semibold mb-6 text-primary">Find Us</h3>
                <MapEmbed
                  query="3H74+RQQ, Engineering College Rd, Thodiyoor, Karunagappalli, Kerala 690523"
                  zoom={16}
                  title="College of Engineering Karunagappally Location"
                  className="mb-3"
                />
                <div className="text-center">
                  <a
                    className="ink-link text-muted-foreground"
                    href="https://maps.google.com/?q=3H74%2BRQQ%2C%20Engineering%20College%20Rd%2C%20Thodiyoor%2C%20Karunagappalli%2C%20Kerala%20690523"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Google Maps
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <ContactFormComponent />
        </div>

        {/* Office Hours */}
        <div className="mt-16">
          <Card className="glass-morphism card-cosmic max-w-2xl mx-auto">
            <CardContent className="p-8 text-center">
              <h3 className="text-2xl font-poppins font-semibold mb-4 text-primary">Office Hours</h3>
              <div className="grid md:grid-cols-2 gap-6 text-muted-foreground">
                <div>
                  <p className="font-semibold text-foreground mb-2">Regular Hours</p>
                  <p>Monday - Friday: 9:00 AM - 5:00 PM</p>
                  <p>Saturday: 9:00 AM - 1:00 PM</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-2">Emergency Contact</p>
                  <p>For urgent matters, please email us</p>
                  <p>Response within 24 hours</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
