import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Shield, TreePine, FileText, Bell, Siren, Users, ChevronRight, Star, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

const problems = [
  { icon: FileText, title: "Documents scattered everywhere", desc: "Across drives, drawers, and email threads — nothing's in one place." },
  { icon: Bell, title: "Missed passport renewals", desc: "Important expirations slip through without a system to track them." },
  { icon: Siren, title: "Can't find info in emergencies", desc: "When it matters most, critical family data is unreachable." },
];

const features = [
  { icon: TreePine, title: "Family Tree Visualization", desc: "See your entire family at a glance with an interactive tree." },
  { icon: FileText, title: "Smart Document Vault", desc: "Upload, organize, and instantly find any family document." },
  { icon: Bell, title: "Expiry Reminders", desc: "Never miss a renewal with automated expiry alerts." },
  { icon: Siren, title: "Emergency Access Mode", desc: "Critical info at your fingertips when every second counts." },
  { icon: Users, title: "Member Profiles", desc: "Complete profiles for every family member in one place." },
  { icon: Shield, title: "Secure & Private", desc: "Bank-level encryption keeps your family data safe." },
];

const testimonials = [
  { name: "Priya Sharma", role: "Mother of 3", text: "EverNest saved us when we needed insurance documents during a hospital visit. Everything was right there." },
  { name: "Rajesh Patel", role: "Family Manager", text: "I used to keep everything in a drawer. Now my whole family's important info is organized and accessible." },
  { name: "Anita Desai", role: "Caregiver", text: "Managing documents for my parents was chaos. EverNest made it simple and stress-free." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <TreePine className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold">EverNest</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button size="sm">Get Started Free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container py-20 md:py-32">
        <motion.div className="max-w-3xl mx-auto text-center" initial="hidden" animate="visible">
          <motion.h1 variants={fadeUp} custom={0} className="text-4xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
            One Secure Home for Your Entire Family's Life
          </motion.h1>
          <motion.p variants={fadeUp} custom={1} className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Store documents, manage family profiles, track expirations, and access critical info in seconds — all in one place.
          </motion.p>
          <motion.div variants={fadeUp} custom={2} className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth?mode=signup">
              <Button size="lg" className="text-base px-8 gap-2">
                Get Started Free <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="text-base px-8" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}>
              See How It Works
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {/* Problems */}
      <section className="bg-muted/50 py-20">
        <div className="container">
          <h2 className="text-3xl font-bold text-center mb-4">Sound Familiar?</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-lg mx-auto">Most families struggle with scattered information. EverNest brings it all together.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {problems.map((p, i) => (
              <motion.div key={i} variants={fadeUp} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="rounded-lg border bg-card p-6 text-center">
                <div className="inline-flex rounded-full bg-destructive/10 p-3 mb-4">
                  <p.icon className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{p.title}</h3>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20">
        <div className="container">
          <h2 className="text-3xl font-bold text-center mb-4">Everything Your Family Needs</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-lg mx-auto">Powerful tools designed to keep your family organized, safe, and prepared.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div key={i} variants={fadeUp} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="rounded-lg border bg-card p-6 hover:shadow-md transition-shadow group">
                <div className="inline-flex rounded-lg bg-primary/10 p-2.5 mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-muted/50 py-20">
        <div className="container">
          <h2 className="text-3xl font-bold text-center mb-12">Trusted by Families</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div key={i} variants={fadeUp} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="rounded-lg border bg-card p-6">
                <div className="flex gap-1 mb-3">
                  {[...Array(5)].map((_, j) => <Star key={j} className="h-4 w-4 fill-accent text-accent" />)}
                </div>
                <p className="text-sm mb-4 italic">"{t.text}"</p>
                <div>
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20">
        <div className="container">
          <h2 className="text-3xl font-bold text-center mb-4">Simple, Transparent Pricing</h2>
          <p className="text-muted-foreground text-center mb-12">Start free, upgrade when you need more.</p>
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Free */}
            <div className="rounded-lg border bg-card p-8">
              <h3 className="text-xl font-bold mb-1">Free</h3>
              <p className="text-muted-foreground text-sm mb-4">For small families getting started</p>
              <p className="text-3xl font-bold mb-6">₹0 <span className="text-sm font-normal text-muted-foreground">/ month</span></p>
              <ul className="space-y-3 mb-8">
                {["Up to 3 family members", "25 documents", "Basic family tree", "Document categories"].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-success" />{f}</li>
                ))}
              </ul>
              <Link to="/auth?mode=signup"><Button variant="outline" className="w-full">Get Started</Button></Link>
            </div>
            {/* Pro */}
            <div className="rounded-lg border-2 border-primary bg-card p-8 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">Most Popular</div>
              <h3 className="text-xl font-bold mb-1">Pro</h3>
              <p className="text-muted-foreground text-sm mb-4">For families who want it all</p>
              <p className="text-3xl font-bold mb-6">₹299 <span className="text-sm font-normal text-muted-foreground">/ month</span></p>
              <ul className="space-y-3 mb-8">
                {["Unlimited family members", "Unlimited documents", "Emergency access mode", "Expiry reminders", "Priority support", "Advanced family tree"].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-success" />{f}</li>
                ))}
              </ul>
              <Link to="/auth?mode=signup"><Button className="w-full">Start Pro Trial</Button></Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card py-12">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <TreePine className="h-5 w-5 text-primary" />
              <span className="font-bold">EverNest</span>
              <span className="text-sm text-muted-foreground ml-2">A digital home for your family.</span>
            </div>
            <p className="text-sm text-muted-foreground">© 2026 EverNest. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
