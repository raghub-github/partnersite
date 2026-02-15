"use client";

import CustomizationForm from '@/components/CustomizationForm';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function CustomizationsContent() {
  const searchParams = useSearchParams();
  const itemId = searchParams?.get('item_id') || '';
  
  return (
    <div>
      <h1>Customizations & Add-ons</h1>
      <CustomizationForm itemId={itemId} onSuccess={() => {
        alert('Customization or Add-on added!');
      }} />
    </div>
  );
}

export default function CustomizationsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CustomizationsContent />
    </Suspense>
  );
}
