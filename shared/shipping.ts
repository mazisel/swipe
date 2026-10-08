export const shippingLabels = {
  preparing: 'Hazırlanıyor',
  shipped: 'Kargoya verildi',
  out_for_delivery: 'Dağıtımda',
  delivered: 'Teslim edildi',
  returned: 'İade edildi',
} as const;
export type ShippingStatus = keyof typeof shippingLabels;
export type Shipping = { status: ShippingStatus; carrier: string; trackingNumber: string; updatedAt: string | null; version: number };
export const emptyShipping: Shipping = { status: 'preparing', carrier: '', trackingNumber: '', updatedAt: null, version: 0 };
