import React, { useEffect } from 'react';

import Header from '@components/Header';
import Navbar from '@components/Navbar';

export default function Navigation({ pageTitle, children }) {
  
  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

  return (
    <div className='fixed'>
      <Header />
      <div className='relative flex'>
        <Navbar />
        <main className='relative w-full h-[var(--content-height)] p-10 overflow-y-auto'>
          {children}
        </main>
      </div>
    </div>
  );
}
