import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { Check, X, Smartphone, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { type PairingRequest, respondToPairingRequest } from '@/lib/api'

interface PairingRequestsProps {
  requests: PairingRequest[]
  isLoading: boolean
}

PairingRequests.displayName = 'PairingRequests'

export function PairingRequests({ requests, isLoading }: PairingRequestsProps) {
  const queryClient = useQueryClient()

  const respondMutation = useMutation({
    mutationFn: ({
      id,
      status,
      response,
    }: {
      id: number
      status: string
      response?: string
    }) => respondToPairingRequest(id, status, response),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pendingRequests'] })
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      queryClient.invalidateQueries({ queryKey: ['securityDashboard'] })
      toast.success(
        variables.status === 'approved'
          ? 'Device has been paired'
          : 'Request has been denied'
      )
    },
    onError: () => {
      toast.error('Error processing request')
    },
  })

  const handleApprove = (id: number) => {
    respondMutation.mutate({ id, status: 'approved' })
  }

  const handleDeny = (id: number) => {
    respondMutation.mutate({ id, status: 'denied', response: 'Manually denied' })
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className='h-6 w-40' />
          <Skeleton className='h-4 w-48' />
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            {[...Array(2)].map((_, i) => (
              <div key={i} className='flex items-center gap-4 p-4 rounded-lg border'>
                <Skeleton className='h-10 w-10 rounded-full' />
                <div className='flex-1 space-y-2'>
                  <Skeleton className='h-4 w-32' />
                  <Skeleton className='h-3 w-24' />
                </div>
                <div className='flex gap-2'>
                  <Skeleton className='h-8 w-24' />
                  <Skeleton className='h-8 w-24' />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Clock className='h-5 w-5' />
          Pending Pairing Requests
        </CardTitle>
        <CardDescription>
          {requests.length > 0
            ? `${requests.length} request${requests.length !== 1 ? 's' : ''} pending`
            : 'No pending requests'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-8 text-center'>
            <Smartphone className='h-12 w-12 text-muted-foreground mb-4' />
            <p className='text-lg font-medium text-muted-foreground'>
              No pending requests
            </p>
            <p className='text-sm text-muted-foreground'>
              New pairing requests will appear here
            </p>
          </div>
        ) : (
          <div className='space-y-3'>
            {requests.map((request) => (
              <div
                key={request.id}
                className='flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors'
              >
                <div className='flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary'>
                  <Smartphone className='h-5 w-5' />
                </div>
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center gap-2'>
                    <span className='font-medium'>
                      {request.device_name ?? 'Unnamed Device'}
                    </span>
                    <Badge variant='outline' className='text-xs'>
                      {request.status}
                    </Badge>
                  </div>
                  <div className='flex items-center gap-2 mt-1'>
                    <span className='text-xs text-muted-foreground font-mono'>
                      {request.device_id.slice(0, 12)}...
                    </span>
                    <span className='text-xs text-muted-foreground'>
                      Requested{' '}
                      {formatDistanceToNow(new Date(request.requested_at), {
                        addSuffix: true,
                        locale: enUS,
                      })}
                    </span>
                  </div>
                </div>
                <div className='flex gap-2'>
                  <Button
                    variant='default'
                    size='sm'
                    onClick={() => handleApprove(request.id)}
                    disabled={respondMutation.isPending}
                  >
                    <Check className='mr-1 h-4 w-4' />
                    Approve
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => handleDeny(request.id)}
                    disabled={respondMutation.isPending}
                  >
                    <X className='mr-1 h-4 w-4' />
                    Deny
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
