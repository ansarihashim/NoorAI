import { motion } from 'framer-motion'

export default function Card({
  as: As = 'div',
  interactive = false,
  className = '',
  children,
  ...rest
}) {
  if (interactive) {
    return (
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        className={[
          'glass p-6',
          'cursor-pointer transition-shadow duration-300 ease-expo hover:shadow-lift',
          className,
        ].join(' ')}
        {...rest}
      >
        {children}
      </motion.div>
    )
  }
  return (
    <As className={['glass p-6', className].join(' ')} {...rest}>
      {children}
    </As>
  )
}
