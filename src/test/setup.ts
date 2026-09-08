import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// В конфигурации без globals Testing Library не подключает автоматическую
// очистку DOM, поэтому размонтируем деревья между тестами явно.
afterEach(cleanup)
