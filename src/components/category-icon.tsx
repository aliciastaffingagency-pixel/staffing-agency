import {
  Baby, Bath, Briefcase, Building2, Car, ChefHat, ClipboardList, Dog, Flower2, GraduationCap, Hammer,
  HeartHandshake, Home, ShieldCheck, Shirt, Sparkles, Sprout, Stethoscope, Store, Truck, Users,
  Utensils, WashingMachine, Wrench, type LucideIcon,
} from 'lucide-react'

// Icons the admin can pick for a category. Categories themselves live in the
// database; this is only the icon palette, keyed by the name stored in staff_categories.icon.
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Home, Baby, Sparkles, HeartHandshake, ChefHat, Shirt, ClipboardList, Car, Sprout, Store, ShieldCheck,
  Bath, Briefcase, Building2, Dog, Flower2, GraduationCap, Hammer, Stethoscope, Truck, Utensils,
  WashingMachine, Wrench, Users,
}

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS) as [string, ...string[]]

export function CategoryIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = (name && CATEGORY_ICONS[name]) || Users
  return <Icon className={className} aria-hidden="true" />
}
