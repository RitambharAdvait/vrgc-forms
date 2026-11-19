import { redirect } from 'next/navigation';

export default function PlannedEventsRedirect() {
  redirect('/?tab=events');
}
