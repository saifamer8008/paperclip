import { useMemo } from 'react';
import { useLocation } from '@/lib/router';
import { cn } from '@/lib/utils';
import {
    Bot,
    CircleDotDashed,
    FileCode,
    Github,
    ShieldCheck,
    LayoutDashboard,
    LifeBuoy,
    BookOpen,
    ChevronLeft,
    ChevronRight,
    Settings,
    DollarSign,
} from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useCompany } from '@/context/CompanyContext';

interface NavItem {
    to: string;
    label: string;
    icon: React.ElementType;
    exact?: boolean;
}

export function Sidebar() {
    const [isExpanded, setIsExpanded] = useLocalStorage('sidebar-expanded', true);
    const location = useLocation();
    const { selectedCompanyId } = useCompany();

    const navItems = useMemo<NavItem[]>(() => [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
        { to: '/issues', label: 'Issues', icon: CircleDotDashed },
        { to: '/agents', label: 'Agents', icon: Bot },
        { to: '/costs', label: 'Costs', icon: DollarSign },
        { to: '/approvals', label: 'Approvals', icon: ShieldCheck },
        { to: '/projects', label: 'Projects', icon: FileCode },
    ], []);

    const bottomNavItems = useMemo<NavItem[]>(() => [
        { to: '/settings', label: 'Settings', icon: Settings },
        { to: 'https://github.com/paperclip-ai/paperclip', label: 'GitHub', icon: Github },
        { to: 'https://docs.paperclip.ai', label: 'Docs', icon: BookOpen },
        { to: 'https://join.slack.com/t/paperclip-ai/shared_invite/zt-2f43x5g9j-2b~tFjB~0yB~Yn_Z~Yn_Yw', label: 'Support', icon: LifeBuoy },
    ], []);

    const renderNavItem = (item: NavItem) => {
        const isActive = item.exact
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to);

        const fullPath = item.to.startsWith('http') ? item.to : `/${selectedCompanyId}${item.to}`;

        return (
            <a
                key={item.to}
                href={fullPath}
                target={item.to.startsWith('http') ? '_blank' : undefined}
                rel={item.to.startsWith('http') ? 'noopener noreferrer' : undefined}
                className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-colors duration-150 h-9',
                    isActive
                        ? 'bg-primary/10 text-primary border-l-2 border-primary rounded-l-none'
                        : 'hover:bg-white/[.04] hover:text-foreground',
                    !isExpanded && 'justify-center'
                )}
            >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className={cn('text-sm font-medium', !isExpanded && 'sr-only')}>
                    {item.label}
                </span>
            </a>
        );
    };

    return (
        <aside
            className={cn(
                'flex flex-col bg-background border-r border-border transition-[width] duration-200 ease-out',
                isExpanded ? 'w-56' : 'w-14'
            )}
        >
            <div className={cn(
                "flex h-14 items-center border-b border-border",
                isExpanded ? "px-4" : "px-3 justify-center"
            )}>
                {isExpanded ? (
                    <img src="/src/assets/lfg-logo-white.png" className="h-7 w-auto" alt="LFG" />
                ) : (
                    <img src="/src/assets/lfg-logo-mark.jpg" className="h-8 w-8 object-cover rounded-lg" alt="LFG" />
                )}
            </div>
            <nav className="flex-1 space-y-1 p-2">
                {navItems.map(renderNavItem)}
            </nav>
            <div className='p-2 border-t border-border'>
                <div className="space-y-1">
                    {bottomNavItems.map(renderNavItem)}
                </div>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="mt-2 w-full flex items-center justify-center h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[.04] transition-colors duration-150"
                >
                    {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                </button>
            </div>
        </aside>
    )
}
