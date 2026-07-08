import { useEffect, useState } from 'react';

import Header from '@components/Header';
import Navbar from '@components/Navbar';

export default function Navigation({ pageTitle, children }) {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  
  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

  return (
    <div className='fixed inset-0 flex min-h-0 flex-col overflow-hidden'>
      <Header
        isNavigationOpen={isNavigationOpen}
        onToggleNavigation={() => setIsNavigationOpen((open) => !open)}
      />
      <div className='relative flex min-h-0 flex-1'>
        <Navbar
          isOpen={isNavigationOpen}
          onClose={() => setIsNavigationOpen(false)}
        />
        <main className='relative min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8 xl:p-10'>
          {children}
        </main>
      </div>
    </div>
  );
}
