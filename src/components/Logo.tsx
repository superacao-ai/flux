import React from 'react';
import Link from 'next/link';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  noLink?: boolean;
  useLogo2?: boolean;
}

const sizeClasses = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-16',
  xl: 'h-20'
};

export default function Logo({ size = 'md', className = '', noLink = false, useLogo2 = false }: LogoProps & { useLogo2?: boolean }) {
  const img = (
    <img
      src={useLogo2 ? '/logo2.png' : '/logo.svg'}
      alt="Studio Superação"
      className={`w-auto ${sizeClasses[size]} ${className} ${noLink ? '' : 'cursor-pointer'}`}
    />
  );

  if (noLink) return img;
  return (
    <Link href="/dashboard" aria-label="Dashboard">
      {img}
    </Link>
  );
}