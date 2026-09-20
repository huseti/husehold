import { useTranslation } from 'react-i18next';
import LookupEditor from './LookupEditor';
import { labelService, mealCategoryService, unitService, ingredientService } from '../services/api';

const NAME_DE = { key: 'name_de', labelKey: 'recipeConfig.nameDe', type: 'text' };
const NAME_EN = { key: 'name_en', labelKey: 'recipeConfig.nameEn', type: 'text' };

export default function RecipeConfig() {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <h3 className="text-xl font-semibold mb-1">{t('recipeConfig.title')}</h3>
      <p className="text-sm text-gray-500 mb-3">{t('recipeConfig.hint')}</p>

      <LookupEditor
        titleKey="recipeConfig.labels"
        service={labelService}
        fields={[{ key: 'color_hex', type: 'color' }, NAME_DE, NAME_EN]}
        newItemDefaults={{ name_de: '', name_en: '', color_hex: '#5b7a5e' }}
      />
      <LookupEditor
        titleKey="recipeConfig.categories"
        service={mealCategoryService}
        fields={[NAME_DE, NAME_EN, { key: 'sort_order', labelKey: 'recipeConfig.order', type: 'number', className: 'w-24' }]}
        newItemDefaults={{ name_de: '', name_en: '', sort_order: 0 }}
      />
      <LookupEditor
        titleKey="recipeConfig.units"
        service={unitService}
        fields={[
          NAME_DE, NAME_EN,
          { key: 'abbreviation_de', labelKey: 'recipeConfig.abbreviationDe', type: 'text', className: 'w-24' },
          { key: 'abbreviation_en', labelKey: 'recipeConfig.abbreviationEn', type: 'text', className: 'w-24' },
        ]}
        newItemDefaults={{ name_de: '', name_en: '', abbreviation_de: '', abbreviation_en: '' }}
      />
      <LookupEditor
        titleKey="recipeConfig.ingredients"
        service={ingredientService}
        fields={[{ key: 'name', labelKey: 'recipeConfig.name', type: 'text' }, { key: 'default_excluded_from_shopping_list', labelKey: 'recipeConfig.excludeFromShopping', type: 'checkbox' }]}
        newItemDefaults={{ name: '' }}
        searchable
      />
    </div>
  );
}
