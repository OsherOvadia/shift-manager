'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/lib/auth';
import { useRouter } from 'next/navigation';

interface OrganizationStats {
  id: string;
  name: string;
  status: 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED';
  contactEmail?: string;
  contactPhone?: string;
  timezone: string;
  createdAt: string;
  approvedAt?: string;
  userCount: number;
  scheduleCount: number;
  shiftTemplateCount: number;
  hasSettings: boolean;
}

interface PlatformStats {
  totalOrganizations: number;
  pendingOrganizations: number;
  approvedOrganizations: number;
  suspendedOrganizations: number;
  totalUsers: number;
  totalSchedules: number;
}

export default function SuperAdminDashboard() {
  const { user, accessToken } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);

  // Redirect if not super admin
  if (user?.role !== 'SUPER_ADMIN') {
    router.push('/dashboard');
    return null;
  }

  // Fetch platform stats
  const { data: stats } = useQuery<PlatformStats>({
    queryKey: ['super-admin', 'stats'],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/super-admin/stats`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  // Fetch organizations
  const { data: organizations } = useQuery<OrganizationStats[]>({
    queryKey: ['super-admin', 'organizations', activeTab],
    queryFn: async () => {
      const endpoint = activeTab === 'pending' ? '/super-admin/organizations/pending' : '/super-admin/organizations';
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Failed to fetch organizations');
      return res.json();
    },
  });

  // Approve organization mutation
  const approveMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/super-admin/organizations/${orgId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Failed to approve');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin'] });
    },
  });

  // Suspend organization mutation
  const suspendMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/super-admin/organizations/${orgId}/suspend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Failed to suspend');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin'] });
    },
  });

  // Reject organization mutation
  const rejectMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/super-admin/organizations/${orgId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Failed to reject');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin'] });
    },
  });

  // Reactivate organization mutation
  const reactivateMutation = useMutation({
    mutationFn: async (orgId: string) => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/super-admin/organizations/${orgId}/reactivate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Failed to reactivate');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin'] });
    },
  });

  const getStatusBadge = (status: string) => {
    const styles = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      SUSPENDED: 'bg-red-100 text-red-800',
      REJECTED: 'bg-gray-100 text-gray-800',
    };
    const labels = {
      PENDING: 'ממתין',
      APPROVED: 'מאושר',
      SUSPENDED: 'מושעה',
      REJECTED: 'נדחה',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">לוח בקרה - מנהל על</h1>
          <p className="text-gray-600">ניהול ומעקב אחר כל הארגונים במערכת</p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg shadow p-4"
            >
              <p className="text-gray-600 text-sm">סה"כ ארגונים</p>
              <p className="text-2xl font-bold text-blue-600">{stats.totalOrganizations}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-lg shadow p-4"
            >
              <p className="text-gray-600 text-sm">ממתינים לאישור</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pendingOrganizations}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-lg shadow p-4"
            >
              <p className="text-gray-600 text-sm">ארגונים מאושרים</p>
              <p className="text-2xl font-bold text-green-600">{stats.approvedOrganizations}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-lg shadow p-4"
            >
              <p className="text-gray-600 text-sm">ארגונים מושעים</p>
              <p className="text-2xl font-bold text-red-600">{stats.suspendedOrganizations}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-lg shadow p-4"
            >
              <p className="text-gray-600 text-sm">סה"כ משתמשים</p>
              <p className="text-2xl font-bold text-purple-600">{stats.totalUsers}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white rounded-lg shadow p-4"
            >
              <p className="text-gray-600 text-sm">סה"כ משמרות</p>
              <p className="text-2xl font-bold text-indigo-600">{stats.totalSchedules}</p>
            </motion.div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('all')}
              className={`pb-2 px-1 border-b-2 font-medium transition-colors ${
                activeTab === 'all'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              כל הארגונים
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`pb-2 px-1 border-b-2 font-medium transition-colors ${
                activeTab === 'pending'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              ממתינים לאישור ({stats?.pendingOrganizations || 0})
            </button>
          </div>
        </div>

        {/* Organizations Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">שם ארגון</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">סטטוס</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">משתמשים</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">משמרות</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">תאריך יצירה</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">פעולות</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {organizations?.map((org) => (
                <tr key={org.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{org.name}</div>
                    {org.contactEmail && <div className="text-sm text-gray-500">{org.contactEmail}</div>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(org.status)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{org.userCount}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{org.scheduleCount}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(org.createdAt).toLocaleDateString('he-IL')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    {org.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => approveMutation.mutate(org.id)}
                          className="text-green-600 hover:text-green-900 ml-2"
                        >
                          אשר
                        </button>
                        <button
                          onClick={() => rejectMutation.mutate(org.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          דחה
                        </button>
                      </>
                    )}
                    {org.status === 'APPROVED' && (
                      <button
                        onClick={() => suspendMutation.mutate(org.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        השעה
                      </button>
                    )}
                    {org.status === 'SUSPENDED' && (
                      <button
                        onClick={() => reactivateMutation.mutate(org.id)}
                        className="text-green-600 hover:text-green-900"
                      >
                        הפעל מחדש
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedOrg(org.id)}
                      className="text-blue-600 hover:text-blue-900 mr-2"
                    >
                      פרטים
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
