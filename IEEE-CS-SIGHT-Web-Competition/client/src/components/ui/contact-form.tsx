import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { contactFormSchema, type ContactForm } from "@shared/schema";

export function ContactFormComponent() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<ContactForm>({
    resolver: zodResolver(contactFormSchema),
  });

  // Prefill subject from URL query param if provided
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const subject = params.get("subject");
      if (subject) setValue("subject", subject as any);
    } catch {}
  }, [setValue]);

  const onSubmit = async (data: ContactForm) => {
    setIsSubmitting(true);
    
    try {
      // Client-side validation and mailto fallback
      const mailtoLink = `mailto:sight@ieee.sbcek.org?subject=${encodeURIComponent(data.subject)}&body=${encodeURIComponent(
        `Name: ${data.firstName} ${data.lastName}\nEmail: ${data.email}\n\nMessage:\n${data.message}`
      )}`;
      
      window.location.href = mailtoLink;
      
      toast({
        title: "Message Prepared",
        description: "Your email client should open now with the pre-filled message.",
      });
      
      reset();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to prepare message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="glass-morphism" data-testid="contact-form">
      <CardContent className="p-8">
        <h3 className="text-2xl font-poppins font-semibold mb-6 text-primary">Send us a Message</h3>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName" className="block text-sm font-medium text-foreground mb-2">
                First Name
              </Label>
              <Input
                id="firstName"
                {...register("firstName")}
                className="input-cosmic"
                placeholder="Enter your first name"
                data-testid="input-first-name"
              />
              {errors.firstName && (
                <p className="text-destructive text-sm mt-1" data-testid="error-first-name">
                  {errors.firstName.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="lastName" className="block text-sm font-medium text-foreground mb-2">
                Last Name
              </Label>
              <Input
                id="lastName"
                {...register("lastName")}
                className="input-cosmic"
                placeholder="Enter your last name"
                data-testid="input-last-name"
              />
              {errors.lastName && (
                <p className="text-destructive text-sm mt-1" data-testid="error-last-name">
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              className="input-cosmic"
              placeholder="your.email@example.com"
              data-testid="input-email"
            />
            {errors.email && (
              <p className="text-destructive text-sm mt-1" data-testid="error-email">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="subject" className="block text-sm font-medium text-foreground mb-2">
              Subject
            </Label>
            <input type="hidden" {...register("subject")} />
            <Select onValueChange={(value) => setValue("subject", value, { shouldValidate: true })} data-testid="select-subject">
              <SelectTrigger className="input-cosmic">
                <SelectValue placeholder="Select a subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="volunteer">Volunteer Opportunities</SelectItem>
                <SelectItem value="partnership">Partnership Inquiry</SelectItem>
                <SelectItem value="project">Project Collaboration</SelectItem>
                <SelectItem value="general">General Inquiry</SelectItem>
              </SelectContent>
            </Select>
            {errors.subject && (
              <p className="text-destructive text-sm mt-1" data-testid="error-subject">
                {errors.subject.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="message" className="block text-sm font-medium text-foreground mb-2">
              Message
            </Label>
            <Textarea
              id="message"
              {...register("message")}
              rows={4}
              className="input-cosmic resize-none"
              placeholder="Tell us about your interest in IEEE SIGHT..."
              data-testid="textarea-message"
            />
            {errors.message && (
              <p className="text-destructive text-sm mt-1" data-testid="error-message">
                {errors.message.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full btn-cosmic"
            data-testid="button-submit"
          >
            {isSubmitting ? "Preparing Message..." : "Send Message"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
