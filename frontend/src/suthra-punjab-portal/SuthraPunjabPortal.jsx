import { useSuthraAutoLogin } from './useSuthraAutoLogin'
import LoaderRickshawBeatReport from './LoaderRickshawBeatReport'
import Spinner from '../components/Spinner'

export default function SuthraPunjabPortal() {
  const { session: suthraSession, autoSigning, autoError } = useSuthraAutoLogin()

  if (autoSigning && !suthraSession) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="md" />
          <p className="text-sm text-neutral-500">Automatically signing in to Suthra Punjab Portal…</p>
        </div>
      </div>
    )
  }

  if (!suthraSession) {
    return (
      <div className="mx-auto max-w-md py-10">
        <p className="text-center text-sm text-neutral-500">
          {autoError || 'Unable to sign in automatically. Please try again later.'}
        </p>
      </div>
    )
  }

  return <LoaderRickshawBeatReport token={suthraSession.token} />
}