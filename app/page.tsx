import CTA from '@/components/CTA';
import FAQ from '@/components/FAQ';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import Problem from '@/components/Problem';
import Proof from '@/components/Proof';
import ProofOfWork from '@/components/ProofOfWork';
import Services from '@/components/Services';

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Problem />
        <Services />
        <ProofOfWork />
        <Proof />
        <FAQ />
        <CTA />
        <Footer />
      </main>
    </>
  );
}
