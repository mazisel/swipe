import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { FollowButton } from '../../components/FollowButton';
import { Product } from '../../../shared/types';
import { api } from '../../lib/api';
import { Page, colors, ErrorText } from '../../components/ui';
import { ProductGrid } from '../../components/ProductGrid';
export default function ShopProfile() {
  const { id } = useLocalSearchParams<{ id: string }>(); const [data, setData] = useState<{ shop: { id: string; name: string; bio: string }; products: Product[] } | null>(null); const [error, setError] = useState('');
  useEffect(() => { let live = true; void api<{ shop: { id: string; name: string; bio: string }; products: Product[] }>(`/shops/${encodeURIComponent(id)}`).then(result => { if (live) setData(result); }).catch(e => { if (live) setError(e.message); }); return () => { live = false; }; }, [id]);
  return <Page title={data?.shop.name || 'Mağaza'} subtitle={data?.shop.bio || 'Kendi dünyasından, senin akışına.'} back><ErrorText message={error} />{data && <><View style={{ marginTop: 22, alignItems: 'flex-start' }}><FollowButton shop={data.shop} /></View><View style={{ marginTop: 26, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.line }}><Text style={{ color: colors.muted, fontSize: 12 }}>{data.products.length} parça</Text></View><ProductGrid products={data.products} /></>}</Page>;
}
