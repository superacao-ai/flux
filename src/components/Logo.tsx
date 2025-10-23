import React from 'react';
import Link from 'next/link';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  noLink?: boolean;
}

const sizeClasses = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-16',
  xl: 'h-20'
};

export default function Logo({ size = 'md', className = '', noLink = false }: LogoProps) {
  const img = (
    <img
      src="https://studiosuperacao.com/wp-content/webp-express/webp-images/uploads/2024/10/240760771_513249899775035_2447574693244800732_n-removebg-1.png.webp"
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