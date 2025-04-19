'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  MapPin, 
  Calendar, 
  LogOut,
  Tag,
  Briefcase,
  CalendarRange
} from 'lucide-react';
import { useAppDispatch } from '@/redux/hooks';
import { logout } from '@/redux/slices/authSlice';

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
}

const NavItem = ({ href, icon, label, isActive }: NavItemProps) => (
  <Link 
    href={href} 
    className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-all hover:bg-slate-100 ${
      isActive ? 'bg-slate-100 text-blue-600' : 'text-slate-600'
    }`}
  >
    {icon}
    <span className="text-sm font-medium">{label}</span>
  </Link>
);

export default function Sidebar() {
  const pathname = usePathname();
  const dispatch = useAppDispatch();

  const handleLogout = () => {
    dispatch(logout());
  };

  const navItems = [
    {
      href: '/admin/dashboard',
      icon: <LayoutDashboard size={18} />,
      label: 'Ümumi məlumatlar',
    },
    {
      href: '/admin/users',
      icon: <Users size={18} />,
      label: 'Müəllimler',
    },
    {
      href: '/admin/course-types',
      icon: <Tag size={18} />,
      label: 'Dərs Tipləri',
    },
    {
      href: '/admin/locations',
      icon: <MapPin size={18} />,
      label: 'Dərs Yerləri',
    },
    {
      href: '/admin/seasons',
      icon: <CalendarRange size={18} />,
      label: 'Kurslar',
    },
    {
      href: '/admin/schedule',
      icon: <Calendar size={18} />,
      label: 'Dərs Programı',
    },
    {
      href: '/admin/leaves',
      icon: <Briefcase size={18} />,
      label: 'Məzuniyyət',
    },
  ];

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-white">
      <div className="p-4">
        <h2 className="text-xl font-bold text-blue-600">Tedris Jurnal</h2>
        <p className="text-xs text-slate-500">Admin Paneli</p>
      </div>
      
      <div className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              isActive={pathname === item.href}
            />
          ))}
        </nav>
      </div>
      
      <div className="border-t p-4">
        <button 
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-all hover:bg-red-50"
        >
          <LogOut size={18} />
          <span>Çıxış</span>
        </button>
      </div>
    </div>
  );
} 