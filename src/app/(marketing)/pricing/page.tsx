import { redirect } from "next/navigation";

/** Company-internal product: no public pricing. */
export default function PricingPage() {
  redirect("/");
}
