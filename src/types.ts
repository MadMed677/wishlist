import type { Timestamp } from 'firebase/firestore';

export type Priority = 1 | 2 | 3;

export interface Wishlist {
  id: string;
  ownerUid: string;
  ownerName: string;
  title: string;
  eventDate: string; // YYYY-MM-DD или ''
  wishes: string; // «Пожелания» автора — свободный текст для гостей, может быть ''
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
  group: boolean; // общий подарок («Подарим вместе»)
}

export interface GroupMember {
  uid: string;
  name: string;
  at: number; // когда присоединился, ms (для порядка; первый — организатор)
}

export interface ReservationDetail {
  id: string; // = id пункта
  uid: string; // кто создал бронь / открыл сбор
  guestName: string;
  group: boolean;
  members: GroupMember[]; // по времени вступления; пусто для обычной брони
  note: string; // комментарий для участников сбора
  noteBy: string;
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
