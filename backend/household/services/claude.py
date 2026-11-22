"""Small helpers shared by every raw-HTTP Claude Messages API call
(recipe_import.py, ingredient_categorization.py)."""


def response_text(data):
    """Returns the text of the first `text` block in a Messages API response
    body, or '' if there is none.

    Current models (Haiku 5.5 included) think adaptively by default, so the
    response can start with a `thinking` block (empty text unless display is
    set) before the actual answer -- `content[0]` isn't necessarily the text.
    """
    for block in data.get('content') or []:
        if block.get('type') == 'text':
            return block.get('text') or ''
    return ''
