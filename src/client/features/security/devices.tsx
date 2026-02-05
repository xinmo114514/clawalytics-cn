import { useQuery } from '@tanstack/react-query'
import { DevicesIcon } from '@/components/icons/devices-icon'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { getDevices, getPendingRequests } from '@/lib/api'
import { DevicesTable } from './components/devices-table'
import { PairingRequests } from './components/pairing-requests'

SecurityDevices.displayName = 'SecurityDevices'

export function SecurityDevices() {
  const { data: devices, isLoading: devicesLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
    refetchInterval: 10000,
  })

  const { data: pendingRequests, isLoading: requestsLoading } = useQuery({
    queryKey: ['pendingRequests'],
    queryFn: getPendingRequests,
    refetchInterval: 5000,
  })

  return (
    <>
      <Header>
        <div className='flex items-center gap-2'>
          <DevicesIcon active className='h-6 w-6' />
          <span className='font-semibold text-lg'>Devices</span>
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
        </div>
      </Header>

      <Main>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>
              Device Management
            </h1>
            <p className='text-muted-foreground'>
              Manage paired devices and pairing requests
            </p>
          </div>
        </div>

        <div className='space-y-6'>
          {/* Pending Pairing Requests */}
          <PairingRequests
            requests={pendingRequests ?? []}
            isLoading={requestsLoading}
          />

          {/* Devices Table */}
          <DevicesTable devices={devices ?? []} isLoading={devicesLoading} />
        </div>
      </Main>
    </>
  )
}
