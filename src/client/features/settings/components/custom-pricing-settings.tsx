import { useEffect, useState, useCallback } from 'react'
import { Pencil, Plus, Trash2, RefreshCw, AlertTriangle, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useLocale } from '@/context/locale-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getCustomRates,
  updateCustomRate,
  deleteCustomRate,
} from '@/lib/api'
import { SettingsCard } from '../settings-page'

interface PricingRecord {
  provider: string
  model: string
  input: number
  output: number
  cacheRead?: number
  cacheWrite?: number
  isCustom: boolean
}

interface EditFormData {
  input: string
  output: string
  cacheRead: string
  cacheWrite: string
}

const VALIDATION_RULES = {
  min: 0,
  max: 999999,
  decimalPlaces: 6,
} as const

function validateRate(value: string): { valid: boolean; message?: string } {
  if (value === '' || value === undefined) {
    return { valid: true }
  }

  const num = Number.parseFloat(value)
  if (Number.isNaN(num)) {
    return { valid: false, message: 'Must be a valid number' }
  }
  if (num < VALIDATION_RULES.min) {
    return { valid: false, message: `Must be >= ${VALIDATION_RULES.min}` }
  }
  if (num > VALIDATION_RULES.max) {
    return { valid: false, message: `Must be <= ${VALIDATION_RULES.max}` }
  }
  if (value.includes('.') && value.split('.')[1].length > VALIDATION_RULES.decimalPlaces) {
    return { valid: false, message: `Max ${VALIDATION_RULES.decimalPlaces} decimal places` }
  }
  return { valid: true }
}

function formatRate(value: number | undefined): string {
  if (value === undefined || value === null) return '-'
  return value.toFixed(4)
}

export function CustomPricingSettings() {
  const { text } = useLocale()
  const [records, setRecords] = useState<PricingRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingRecord, setEditingRecord] = useState<PricingRecord | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [recordToDelete, setRecordToDelete] = useState<PricingRecord | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [editForm, setEditForm] = useState<EditFormData>({
    input: '',
    output: '',
    cacheRead: '',
    cacheWrite: '',
  })
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof EditFormData, string>>>({})
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newProvider, setNewProvider] = useState('')
  const [newModel, setNewModel] = useState('')
  const [newForm, setNewForm] = useState<EditFormData>({
    input: '',
    output: '',
    cacheRead: '',
    cacheWrite: '',
  })
  const [newFormErrors, setNewFormErrors] = useState<Partial<Record<keyof EditFormData, string>>>({})

  const loadRecords = useCallback(async () => {
    try {
      setIsLoading(true)
      const customRates = await getCustomRates()
      const flatRecords: PricingRecord[] = []

      for (const [provider, models] of Object.entries(customRates)) {
        for (const [model, rate] of Object.entries(models)) {
          flatRecords.push({
            provider,
            model,
            input: rate.input,
            output: rate.output,
            cacheRead: rate.cacheRead,
            cacheWrite: rate.cacheWrite,
            isCustom: true,
          })
        }
      }

      setRecords(flatRecords)
    } catch (error) {
      console.error('Failed to load custom rates:', error)
      toast.error(text('加载自定义定价失败', 'Failed to load custom rates'))
    } finally {
      setIsLoading(false)
    }
  }, [text])

  useEffect(() => {
    void loadRecords()
  }, [loadRecords])

  function validateForm(form: EditFormData): boolean {
    const errors: Partial<Record<keyof EditFormData, string>> = {}
    let isValid = true

    const inputValidation = validateRate(form.input)
    if (!inputValidation.valid) {
      errors.input = inputValidation.message || 'Invalid input'
      isValid = false
    }

    const outputValidation = validateRate(form.output)
    if (!outputValidation.valid) {
      errors.output = outputValidation.message || 'Invalid output'
      isValid = false
    }

    if (form.cacheRead) {
      const cacheReadValidation = validateRate(form.cacheRead)
      if (!cacheReadValidation.valid) {
        errors.cacheRead = cacheReadValidation.message || 'Invalid cacheRead'
        isValid = false
      }
    }

    if (form.cacheWrite) {
      const cacheWriteValidation = validateRate(form.cacheWrite)
      if (!cacheWriteValidation.valid) {
        errors.cacheWrite = cacheWriteValidation.message || 'Invalid cacheWrite'
        isValid = false
      }
    }

    setFormErrors(errors)
    return isValid
  }

  function validateNewForm(form: EditFormData): boolean {
    const errors: Partial<Record<keyof EditFormData, string>> = {}
    let isValid = true

    const inputValidation = validateRate(form.input)
    if (!inputValidation.valid) {
      errors.input = inputValidation.message || 'Invalid input'
      isValid = false
    }

    const outputValidation = validateRate(form.output)
    if (!outputValidation.valid) {
      errors.output = outputValidation.message || 'Invalid output'
      isValid = false
    }

    if (form.cacheRead) {
      const cacheReadValidation = validateRate(form.cacheRead)
      if (!cacheReadValidation.valid) {
        errors.cacheRead = cacheReadValidation.message || 'Invalid cacheRead'
        isValid = false
      }
    }

    if (form.cacheWrite) {
      const cacheWriteValidation = validateRate(form.cacheWrite)
      if (!cacheWriteValidation.valid) {
        errors.cacheWrite = cacheWriteValidation.message || 'Invalid cacheWrite'
        isValid = false
      }
    }

    setNewFormErrors(errors)
    return isValid
  }

  function openEditDialog(record: PricingRecord) {
    setEditingRecord(record)
    setEditForm({
      input: record.input.toString(),
      output: record.output.toString(),
      cacheRead: record.cacheRead?.toString() || '',
      cacheWrite: record.cacheWrite?.toString() || '',
    })
    setFormErrors({})
  }

  function closeEditDialog() {
    setEditingRecord(null)
    setEditForm({ input: '', output: '', cacheRead: '', cacheWrite: '' })
    setFormErrors({})
  }

  async function handleSaveEdit() {
    if (!editingRecord) return
    if (!validateForm(editForm)) return

    try {
      setIsSaving(true)
      const rate = {
        input: Number.parseFloat(editForm.input),
        output: Number.parseFloat(editForm.output),
        ...(editForm.cacheRead ? { cacheRead: Number.parseFloat(editForm.cacheRead) } : {}),
        ...(editForm.cacheWrite ? { cacheWrite: Number.parseFloat(editForm.cacheWrite) } : {}),
      }

      const result = await updateCustomRate(editingRecord.provider, editingRecord.model, rate)

      if (result.priceChange?.significant) {
        toast.warning(
          text(
            `价格变动提醒: ${editingRecord.provider}/${editingRecord.model} 的价格已变更`,
            `Price change alert: ${editingRecord.provider}/${editingRecord.model} pricing has been updated`
          ),
          {
            description: text(
              `输入: ¥${result.priceChange.oldInput} → ¥${result.priceChange.newInput} / 输出: ¥${result.priceChange.oldOutput} → ¥${result.priceChange.newOutput}`,
              `Input: ¥${result.priceChange.oldInput} → ¥${result.priceChange.newInput} / Output: ¥${result.priceChange.oldOutput} → ¥${result.priceChange.newOutput}`
            ),
          }
        )
      } else {
        toast.success(
          text('定价已更新', 'Pricing updated')
        )
      }

      closeEditDialog()
      void loadRecords()
    } catch (error) {
      console.error('Failed to update rate:', error)
      toast.error(text('更新定价失败', 'Failed to update pricing'))
    } finally {
      setIsSaving(false)
    }
  }

  function openDeleteDialog(record: PricingRecord) {
    setRecordToDelete(record)
    setIsDeleteDialogOpen(true)
  }

  function closeDeleteDialog() {
    setRecordToDelete(null)
    setIsDeleteDialogOpen(false)
  }

  async function handleDelete() {
    if (!recordToDelete) return

    try {
      setIsSaving(true)
      await deleteCustomRate(recordToDelete.provider, recordToDelete.model)
      toast.success(text('已删除自定义定价', 'Custom pricing deleted'))
      closeDeleteDialog()
      void loadRecords()
    } catch (error) {
      console.error('Failed to delete rate:', error)
      toast.error(text('删除定价失败', 'Failed to delete pricing'))
    } finally {
      setIsSaving(false)
    }
  }

  function openAddDialog() {
    setIsAddingNew(true)
    setNewProvider('')
    setNewModel('')
    setNewForm({ input: '', output: '', cacheRead: '', cacheWrite: '' })
    setNewFormErrors({})
  }

  function closeAddDialog() {
    setIsAddingNew(false)
    setNewProvider('')
    setNewModel('')
    setNewForm({ input: '', output: '', cacheRead: '', cacheWrite: '' })
    setNewFormErrors({})
  }

  async function handleAddNew() {
    if (!newProvider.trim() || !newModel.trim()) {
      toast.error(text('请填写提供商和模型名称', 'Please fill in provider and model name'))
      return
    }
    if (!validateNewForm(newForm)) return

    try {
      setIsSaving(true)
      const rate = {
        input: Number.parseFloat(newForm.input),
        output: Number.parseFloat(newForm.output),
        ...(newForm.cacheRead ? { cacheRead: Number.parseFloat(newForm.cacheRead) } : {}),
        ...(newForm.cacheWrite ? { cacheWrite: Number.parseFloat(newForm.cacheWrite) } : {}),
      }

      await updateCustomRate(newProvider.trim(), newModel.trim(), rate)
      toast.success(text('已添加自定义定价', 'Custom pricing added'))
      closeAddDialog()
      void loadRecords()
    } catch (error) {
      console.error('Failed to add rate:', error)
      toast.error(text('添加定价失败', 'Failed to add pricing'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <SettingsCard
        title={text('自定义模型定价', 'Custom Model Pricing')}
        description={text(
          '管理自定义模型定价配置，覆盖默认定价用于精确成本计算',
          'Manage custom model pricing configurations to override defaults for accurate cost calculation'
        )}
      >
        <div className='flex justify-end mb-4'>
          <Button onClick={openAddDialog} variant='default'>
            <Plus className='size-4 mr-2' />
            {text('添加新定价', 'Add New Pricing')}
          </Button>
        </div>

        {isLoading ? (
          <div className='flex items-center justify-center py-8'>
            <RefreshCw className='size-6 animate-spin text-muted-foreground' />
          </div>
        ) : records.length === 0 ? (
          <div className='text-center py-8 text-muted-foreground'>
            <p>{text('暂无自定义定价记录', 'No custom pricing records yet')}</p>
            <p className='text-sm mt-1'>
              {text('点击上方按钮添加新的自定义定价', 'Click the button above to add new custom pricing')}
            </p>
          </div>
        ) : (
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{text('提供商', 'Provider')}</TableHead>
                  <TableHead>{text('模型', 'Model')}</TableHead>
                  <TableHead className='text-right'>{text('输入价格 (¥/M)', 'Input (¥/M)')}</TableHead>
                  <TableHead className='text-right'>{text('输出价格 (¥/M)', 'Output (¥/M)')}</TableHead>
                  <TableHead className='text-right'>{text('缓存读取 (¥/M)', 'Cache Read (¥/M)')}</TableHead>
                  <TableHead className='text-right'>{text('缓存写入 (¥/M)', 'Cache Write (¥/M)')}</TableHead>
                  <TableHead className='w-[120px]'>{text('操作', 'Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={`${record.provider}/${record.model}`}>
                    <TableCell className='font-medium'>{record.provider}</TableCell>
                    <TableCell>{record.model}</TableCell>
                    <TableCell className='text-right tabular-nums'>{formatRate(record.input)}</TableCell>
                    <TableCell className='text-right tabular-nums'>{formatRate(record.output)}</TableCell>
                    <TableCell className='text-right tabular-nums'>{formatRate(record.cacheRead)}</TableCell>
                    <TableCell className='text-right tabular-nums'>{formatRate(record.cacheWrite)}</TableCell>
                    <TableCell>
                      <div className='flex items-center gap-1'>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => openEditDialog(record)}
                          title={text('编辑', 'Edit')}
                        >
                          <Pencil className='size-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='icon'
                          onClick={() => openDeleteDialog(record)}
                          title={text('删除', 'Delete')}
                          className='text-destructive hover:text-destructive'
                        >
                          <Trash2 className='size-4' />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SettingsCard>

      {/* Edit Dialog */}
      <Dialog open={!!editingRecord} onOpenChange={() => closeEditDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {text('编辑定价', 'Edit Pricing')}
            </DialogTitle>
            <DialogDescription>
              {editingRecord && `${editingRecord.provider} / ${editingRecord.model}`}
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>
                {text('输入价格 (¥/M tokens)', 'Input Price (¥/M tokens)')}
              </label>
              <Input
                value={editForm.input}
                onChange={(e) => setEditForm({ ...editForm, input: e.target.value })}
                placeholder='0.00'
                type='number'
                step='0.0001'
                min='0'
              />
              {formErrors.input && (
                <p className='text-sm text-destructive flex items-center gap-1'>
                  <AlertTriangle className='size-3' />
                  {formErrors.input}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <label className='text-sm font-medium'>
                {text('输出价格 (¥/M tokens)', 'Output Price (¥/M tokens)')}
              </label>
              <Input
                value={editForm.output}
                onChange={(e) => setEditForm({ ...editForm, output: e.target.value })}
                placeholder='0.00'
                type='number'
                step='0.0001'
                min='0'
              />
              {formErrors.output && (
                <p className='text-sm text-destructive flex items-center gap-1'>
                  <AlertTriangle className='size-3' />
                  {formErrors.output}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <label className='text-sm font-medium'>
                {text('缓存读取价格 (¥/M tokens，可选)', 'Cache Read Price (¥/M tokens, optional)')}
              </label>
              <Input
                value={editForm.cacheRead}
                onChange={(e) => setEditForm({ ...editForm, cacheRead: e.target.value })}
                placeholder='0.00'
                type='number'
                step='0.0001'
                min='0'
              />
              {formErrors.cacheRead && (
                <p className='text-sm text-destructive flex items-center gap-1'>
                  <AlertTriangle className='size-3' />
                  {formErrors.cacheRead}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <label className='text-sm font-medium'>
                {text('缓存写入价格 (¥/M tokens，可选)', 'Cache Write Price (¥/M tokens, optional)')}
              </label>
              <Input
                value={editForm.cacheWrite}
                onChange={(e) => setEditForm({ ...editForm, cacheWrite: e.target.value })}
                placeholder='0.00'
                type='number'
                step='0.0001'
                min='0'
              />
              {formErrors.cacheWrite && (
                <p className='text-sm text-destructive flex items-center gap-1'>
                  <AlertTriangle className='size-3' />
                  {formErrors.cacheWrite}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={closeEditDialog}>
              {text('取消', 'Cancel')}
            </Button>
            <Button onClick={() => void handleSaveEdit()} disabled={isSaving}>
              {isSaving ? (
                <RefreshCw className='size-4 animate-spin mr-2' />
              ) : (
                <Check className='size-4 mr-2' />
              )}
              {text('保存', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={() => closeDeleteDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {text('确认删除', 'Confirm Delete')}
            </DialogTitle>
            <DialogDescription>
              {text(
                `确定要删除 ${recordToDelete?.provider}/${recordToDelete?.model} 的自定义定价吗？删除后将恢复默认定价。`,
                `Are you sure you want to delete the custom pricing for ${recordToDelete?.provider}/${recordToDelete?.model}? It will revert to default pricing.`
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant='outline' onClick={closeDeleteDialog}>
              {text('取消', 'Cancel')}
            </Button>
            <Button variant='destructive' onClick={() => void handleDelete()} disabled={isSaving}>
              {isSaving && <RefreshCw className='size-4 animate-spin mr-2' />}
              {text('删除', 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Dialog */}
      <Dialog open={isAddingNew} onOpenChange={() => closeAddDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {text('添加新定价', 'Add New Pricing')}
            </DialogTitle>
            <DialogDescription>
              {text('为新的提供商/模型添加自定义定价', 'Add custom pricing for a new provider/model')}
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>
                {text('提供商', 'Provider')}
              </label>
              <Input
                value={newProvider}
                onChange={(e) => setNewProvider(e.target.value)}
                placeholder='deepseek'
              />
            </div>

            <div className='space-y-2'>
              <label className='text-sm font-medium'>
                {text('模型', 'Model')}
              </label>
              <Input
                value={newModel}
                onChange={(e) => setNewModel(e.target.value)}
                placeholder='deepseek-v4'
              />
            </div>

            <div className='space-y-2'>
              <label className='text-sm font-medium'>
                {text('输入价格 (¥/M tokens)', 'Input Price (¥/M tokens)')}
              </label>
              <Input
                value={newForm.input}
                onChange={(e) => setNewForm({ ...newForm, input: e.target.value })}
                placeholder='0.00'
                type='number'
                step='0.0001'
                min='0'
              />
              {newFormErrors.input && (
                <p className='text-sm text-destructive flex items-center gap-1'>
                  <AlertTriangle className='size-3' />
                  {newFormErrors.input}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <label className='text-sm font-medium'>
                {text('输出价格 (¥/M tokens)', 'Output Price (¥/M tokens)')}
              </label>
              <Input
                value={newForm.output}
                onChange={(e) => setNewForm({ ...newForm, output: e.target.value })}
                placeholder='0.00'
                type='number'
                step='0.0001'
                min='0'
              />
              {newFormErrors.output && (
                <p className='text-sm text-destructive flex items-center gap-1'>
                  <AlertTriangle className='size-3' />
                  {newFormErrors.output}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <label className='text-sm font-medium'>
                {text('缓存读取价格 (¥/M tokens，可选)', 'Cache Read Price (¥/M tokens, optional)')}
              </label>
              <Input
                value={newForm.cacheRead}
                onChange={(e) => setNewForm({ ...newForm, cacheRead: e.target.value })}
                placeholder='0.00'
                type='number'
                step='0.0001'
                min='0'
              />
              {newFormErrors.cacheRead && (
                <p className='text-sm text-destructive flex items-center gap-1'>
                  <AlertTriangle className='size-3' />
                  {newFormErrors.cacheRead}
                </p>
              )}
            </div>

            <div className='space-y-2'>
              <label className='text-sm font-medium'>
                {text('缓存写入价格 (¥/M tokens，可选)', 'Cache Write Price (¥/M tokens, optional)')}
              </label>
              <Input
                value={newForm.cacheWrite}
                onChange={(e) => setNewForm({ ...newForm, cacheWrite: e.target.value })}
                placeholder='0.00'
                type='number'
                step='0.0001'
                min='0'
              />
              {newFormErrors.cacheWrite && (
                <p className='text-sm text-destructive flex items-center gap-1'>
                  <AlertTriangle className='size-3' />
                  {newFormErrors.cacheWrite}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={closeAddDialog}>
              {text('取消', 'Cancel')}
            </Button>
            <Button onClick={() => void handleAddNew()} disabled={isSaving}>
              {isSaving ? (
                <RefreshCw className='size-4 animate-spin mr-2' />
              ) : (
                <Plus className='size-4 mr-2' />
              )}
              {text('添加', 'Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}