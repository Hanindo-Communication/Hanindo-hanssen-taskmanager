'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type HashAwareNavLinkProps = {
  href: string;
  pathnameMatch: string;
  /** Hash tanpa `#`; string kosong = tidak memakai segment hash khusus */
  expectedHash: string;
  className: string;
  activeClassName: string;
  children: React.ReactNode;
  title?: string;
  'aria-label'?: string;
};

/**
 * Link sidebar yang menyorot aktif berdasarkan pathname + fragment (untuk dua panel di satu halaman).
 */
export function HashAwareNavLink({
  href,
  pathnameMatch,
  expectedHash,
  className,
  activeClassName,
  children,
  title,
  'aria-label': ariaLabel,
}: HashAwareNavLinkProps) {
  const pathname = usePathname();
  const [hash, setHash] = useState('');

  useEffect(() => {
    const sync = () => setHash(typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '');
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const onPage = pathname === pathnameMatch;
  const active =
    onPage &&
    (expectedHash === '' ? hash !== 'tiktok-sales' : hash === expectedHash);

  return (
    <Link
      href={href}
      className={`${className}${active ? ` ${activeClassName}` : ''}`}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  );
}
