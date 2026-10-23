/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * GoogleIcon Component - Renders the Google logo.
 * Used primarily in the Login component for Google Sign-In.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * GoogleIcon: Main component.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * None
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * assets: Google SVG icon.
 */

import googleIcon from '../../assets/icons/google.svg'

interface GoogleIconProps {
  className?: string
}

export default function GoogleIcon({ className = 'w-5 h-5' }: GoogleIconProps) {
  return (
    <img
      src={googleIcon}
      alt="Google"
      className={className}
    />
  )
}
