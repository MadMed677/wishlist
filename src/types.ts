import type { Timestamp } from 'firebase/firestore';

export type Priority = 1 | 2 | 3;

export interface Wishlist {
  id: string;
  ownerUid: string;
  ownerName: string;
  title: string;
  eventDate: string; // YYYY-MM-DD или ''
  createdAt: Timestamp | null;
}

export interface ItemData {
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  price: string;
  priority: Priority;
}

export interface Item extends ItemData {
  id: string;
  createdAt: Timestamp | null;
}

export interface Reservation {
  id: string; // = id пункта
  uid: string;
}

export interface ReservationDetail {
  id: string; // = id пункта
  uid: string;
  guestName: string;
}

export interface GiftData {
  title: string;
  description: string;
  url: string;
  price: string;
}

export interface GuestGift extends GiftData {
  id: string;
  uid: string;
  guestName: string;
  createdAt: Timestamp | null;
}
