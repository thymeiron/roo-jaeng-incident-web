import { AlertFlow, Footer, Hero, Navbar, QuickGuide, Success, Troubleshooting } from "@/components/LandingPage";

export default function Home() {
  return <><a className="skip-link" href="#main-content">Skip to content</a><Navbar /><main id="main-content"><div id="top"><Hero /></div><AlertFlow /><QuickGuide /><Success /><Troubleshooting /></main><Footer /></>;
}
