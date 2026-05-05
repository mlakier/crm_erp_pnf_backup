'use client'

import type { ReactNode } from 'react'
import RecordDetailActionBar from '@/components/RecordDetailActionBar'

export default function TransactionActionStack({
  mode,
  cancelHref,
  formId,
  recordId,
  primaryActions,
  secondaryActions,
}: {
  mode: 'detail' | 'edit' | 'create' | 'customize'
  cancelHref?: string
  formId?: string
  recordId?: string
  primaryActions?: ReactNode
  secondaryActions?: ReactNode
}) {
  return (
    <RecordDetailActionBar
      mode={mode}
      detailHref={cancelHref}
      formId={formId}
      recordId={recordId}
      useTransactionSaveButton
      detailExtraActions={
        <>
          {primaryActions}
          {secondaryActions}
        </>
      }
      editExtraActions={primaryActions}
      createExtraActions={primaryActions}
    />
  )
}
